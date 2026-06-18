/**
 * The assistant's "brain": a context-aware recommendation engine.
 *
 * Rather than printing a fixed list of green tips, this engine inspects the
 * user's actual footprint and only surfaces actions that (a) apply to their
 * situation and (b) would meaningfully cut their emissions. Each action
 * estimates its saving from the user's own numbers, then actions are ranked by
 * impact-per-effort so the most worthwhile, achievable steps rise to the top.
 *
 * This is where "logical decision making based on user context" lives.
 */

import {
  TRANSPORT_FACTORS,
  GRID_INTENSITY,
  FLIGHT_TRIP_KM,
  DIET_DAILY,
  SHOPPING_ANNUAL,
  WASTE_ANNUAL,
  RECYCLING_AVOIDED_SHARE,
} from '../data/emissionFactors.js';
import {
  annualize,
  toNonNegativeNumber,
  carEmissionFactor,
  CATEGORY_LABELS,
} from './calculator.js';
import { projectFootprint } from './planner.js';
import { roundTo as round } from './math.js';

/** Effort levels lightly bias ranking toward easy wins. */
const EFFORT_WEIGHT = Object.freeze({ low: 1, medium: 0.85, high: 0.7 });

/** Ignore actions that would save less than this (kg/yr) — avoids noise. */
const MIN_SAVING_KG = 40;

/**
 * Tuning for the action library, named and grouped so every estimate is
 * transparent and adjustable in one place rather than scattered as bare
 * literals inside the action definitions below.
 */

/** Minimum yearly kg an action's target activity must reach to be relevant. */
const RELEVANT_ABOVE_KG = Object.freeze({
  carActiveTravel: 150,
  carShare: 500,
  carModeShift: 400,
  carSwitchEv: 900,
  shortFlight: 150,
  longFlight: 700,
  electricityGreenTariff: 200,
  electricityEfficiency: 300,
  heatingGas: 250,
  dietFoodWaste: 1000,
});

/** Fraction of an activity's emissions a behaviour is estimated to remove. */
const SAVING_SHARE = Object.freeze({
  activeTravel: 0.15, // walk/cycle the shortest car trips
  carShare: 0.5, // carpool halves emissions attributed to you
  modeShift: 0.3, // shift ~a third of driving to transit
  longFlight: 0.5, // take one fewer of frequent long-haul trips
  efficientElectricity: 0.12, // LEDs + A-rated appliances
  heatingEfficiency: 0.13, // insulation + 1 °C lower thermostat
  foodWaste: 0.08, // planning meals / using leftovers
  mindfulShopping: 0.4, // share of the average→low gap that's realistic
});

/**
 * Assemble everything an action needs to reason about the user. Pre-computing
 * annualized activity here keeps each action definition small and readable.
 */
function buildContext(profile, footprint) {
  const period = footprint.period;
  const t = profile.transport ?? {};
  const carFactor = carEmissionFactor(t.carFuel);
  const occupancy = Math.max(1, toNonNegativeNumber(t.carOccupancy, 1));

  return {
    profile,
    footprint,
    parts: {
      transport: footprint.details.transport.parts,
      home: footprint.details.home.parts,
    },
    annual: {
      carKm: annualize(t.carKm, period),
      flightShortKm: toNonNegativeNumber(t.flightsShortPerYear) * FLIGHT_TRIP_KM.shortHaul,
    },
    carFactorEffective: carFactor / occupancy,
    occupancy,
  };
}

/**
 * The action library. Each entry is self-describing and pure: given a context
 * it can say whether it applies, how much it would save, and how to phrase it.
 * Adding a new behaviour is just appending one object here.
 */
const ACTIONS = [
  // ---- Transport -------------------------------------------------------
  {
    id: 'active-travel',
    category: 'transport',
    title: 'Walk or cycle short trips',
    effort: 'low',
    applies: (c) => c.parts.transport.car > RELEVANT_ABOVE_KG.carActiveTravel,
    saving: (c) => c.parts.transport.car * SAVING_SHARE.activeTravel,
    detail: () =>
      'Swapping the shortest car journeys for walking or cycling typically removes about 15% of car emissions — and it’s free.',
  },
  {
    id: 'car-share',
    category: 'transport',
    title: 'Share rides / increase car occupancy',
    effort: 'low',
    applies: (c) => c.occupancy <= 1 && c.parts.transport.car > RELEVANT_ABOVE_KG.carShare,
    saving: (c) => c.parts.transport.car * SAVING_SHARE.carShare,
    detail: () =>
      'Carpooling with one other person halves the emissions attributed to each of you for the same journeys.',
  },
  {
    id: 'public-transport',
    category: 'transport',
    title: 'Move some commutes to public transport',
    effort: 'medium',
    applies: (c) =>
      c.profile.transport.carFuel !== 'electric' &&
      c.parts.transport.car > RELEVANT_ABOVE_KG.carModeShift,
    saving: (c) =>
      SAVING_SHARE.modeShift * c.annual.carKm * (c.carFactorEffective - TRANSPORT_FACTORS.bus),
    detail: () =>
      'Shifting roughly a third of your driving to bus or train keeps you mobile while cutting a large slice of transport emissions.',
  },
  {
    id: 'switch-ev',
    category: 'transport',
    title: 'Switch to an electric vehicle',
    effort: 'high',
    applies: (c) =>
      ['petrol', 'diesel'].includes(c.profile.transport.carFuel) &&
      c.parts.transport.car > RELEVANT_ABOVE_KG.carSwitchEv,
    saving: (c) => c.annual.carKm * (c.carFactorEffective - TRANSPORT_FACTORS.carElectric),
    detail: () =>
      'You drive enough that an EV (charged on a typical grid) would dramatically cut your per-kilometre emissions over its lifetime.',
  },
  {
    id: 'train-not-flight',
    category: 'transport',
    title: 'Take the train instead of short-haul flights',
    effort: 'medium',
    applies: (c) => c.parts.transport.flightShort > RELEVANT_ABOVE_KG.shortFlight,
    saving: (c) =>
      c.annual.flightShortKm * (TRANSPORT_FACTORS.flightShortHaul - TRANSPORT_FACTORS.train),
    detail: () =>
      'For trips under ~1,500 km, rail can cut the journey’s emissions by around 80% versus flying.',
  },
  {
    id: 'fewer-long-flights',
    category: 'transport',
    title: 'Take one fewer long-haul flight',
    effort: 'medium',
    applies: (c) => c.parts.transport.flightLong > RELEVANT_ABOVE_KG.longFlight,
    saving: (c) => c.parts.transport.flightLong * SAVING_SHARE.longFlight,
    detail: () =>
      'Long-haul flights are among the most carbon-intensive things an individual can do. Replacing or combining trips makes a big dent.',
  },

  // ---- Home energy -----------------------------------------------------
  {
    id: 'green-tariff',
    category: 'home',
    title: 'Switch to a renewable electricity tariff',
    effort: 'low',
    applies: (c) =>
      c.profile.home.gridRegion !== 'renewable' &&
      c.parts.home.electricity > RELEVANT_ABOVE_KG.electricityGreenTariff,
    saving: (c) => {
      const current = GRID_INTENSITY[c.profile.home.gridRegion] ?? GRID_INTENSITY.world;
      return c.parts.home.electricity * (1 - GRID_INTENSITY.renewable / current);
    },
    detail: () =>
      'A certified green tariff is often a same-day switch and can cut almost all of your electricity emissions.',
  },
  {
    id: 'efficient-electricity',
    category: 'home',
    title: 'Upgrade to LED lighting & efficient appliances',
    effort: 'medium',
    applies: (c) => c.parts.home.electricity > RELEVANT_ABOVE_KG.electricityEfficiency,
    saving: (c) => c.parts.home.electricity * SAVING_SHARE.efficientElectricity,
    detail: () =>
      'LED bulbs and high-efficiency (A-rated) appliances typically trim home electricity use by 10–15%.',
  },
  {
    id: 'heating-efficiency',
    category: 'home',
    title: 'Improve heating: insulation + 1 °C lower',
    effort: 'medium',
    applies: (c) => c.parts.home.gas > RELEVANT_ABOVE_KG.heatingGas,
    saving: (c) => c.parts.home.gas * SAVING_SHARE.heatingEfficiency,
    detail: () =>
      'Better insulation and turning the thermostat down a single degree noticeably reduces gas use over a heating season.',
  },

  // ---- Diet ------------------------------------------------------------
  {
    id: 'diet-shift',
    category: 'diet',
    title: 'Shift one step toward plant-based eating',
    effort: 'low',
    applies: (c) => dietTarget(c.profile.diet.type) !== null,
    saving: (c) => {
      const target = dietTarget(c.profile.diet.type);
      if (!target) return 0;
      return (DIET_DAILY[c.profile.diet.type] - DIET_DAILY[target]) * 365;
    },
    detail: (c) => {
      const target = dietTarget(c.profile.diet.type);
      const labels = {
        lowMeat: 'eating meat only a few times a week',
        vegetarian: 'going vegetarian',
        vegan: 'going fully plant-based',
      };
      return `Moving toward ${labels[target] ?? 'a more plant-rich diet'} is one of the highest-impact food choices available to you.`;
    },
  },
  {
    id: 'food-waste',
    category: 'diet',
    title: 'Cut household food waste',
    effort: 'low',
    applies: (c) => c.footprint.categories.diet > RELEVANT_ABOVE_KG.dietFoodWaste,
    saving: (c) => c.footprint.categories.diet * SAVING_SHARE.foodWaste,
    detail: () =>
      'Planning meals and using leftovers avoids the emissions baked into food that’s bought but never eaten (~8% for many households).',
  },

  // ---- Shopping --------------------------------------------------------
  {
    id: 'buy-less',
    category: 'shopping',
    title: 'Buy less, choose second-hand & repair',
    effort: 'medium',
    applies: (c) => c.profile.shopping.level === 'high',
    saving: () => SHOPPING_ANNUAL.high - SHOPPING_ANNUAL.average,
    detail: () =>
      'Keeping clothes and electronics longer and buying pre-owned avoids the large "embodied" emissions of making new goods.',
  },
  {
    id: 'mindful-shopping',
    category: 'shopping',
    title: 'Repair and reuse before replacing',
    effort: 'low',
    applies: (c) => c.profile.shopping.level === 'average',
    saving: () => (SHOPPING_ANNUAL.average - SHOPPING_ANNUAL.low) * SAVING_SHARE.mindfulShopping,
    detail: () =>
      'Small habits — repairing, borrowing, and choosing durable goods — steadily lower the footprint of everything you own.',
  },

  // ---- Waste -----------------------------------------------------------
  {
    id: 'recycle-compost',
    category: 'waste',
    title: 'Recycle and compost consistently',
    effort: 'low',
    applies: (c) => !c.profile.waste.recycles,
    saving: (c) => {
      const base = WASTE_ANNUAL[c.profile.waste.level] ?? WASTE_ANNUAL.average;
      return base * RECYCLING_AVOIDED_SHARE;
    },
    detail: () =>
      'Separating recycling and composting food scraps keeps waste out of landfill, avoiding methane and disposal emissions.',
  },
];

/** The next sensible dietary step, or null if already fully plant-based. */
function dietTarget(type) {
  const ladder = {
    meatHeavy: 'lowMeat',
    average: 'lowMeat',
    lowMeat: 'vegetarian',
    pescatarian: 'vegetarian',
    vegetarian: 'vegan',
    vegan: null,
  };
  return ladder[type] ?? null;
}

/**
 * Generate ranked, personalized recommendations for a profile + footprint.
 *
 * @param {object} profile   the user's activity profile
 * @param {object} footprint output of calculateFootprint(profile)
 * @param {object} [options]
 * @param {number} [options.limit=6] max recommendations to return
 * @returns {{
 *   recommendations: Array<object>,
 *   totalPotentialSaving: number,
 *   projectedTotal: number,
 *   projectedReductionPct: number
 * }}
 */
export function recommend(profile, footprint, { limit = 6 } = {}) {
  const context = buildContext(profile, footprint);

  const candidates = ACTIONS.filter((action) => safeApplies(action, context))
    .map((action) => {
      const saving = Math.max(0, round(safeSaving(action, context)));
      return {
        id: action.id,
        category: action.category,
        categoryLabel: CATEGORY_LABELS[action.category] ?? action.category,
        title: action.title,
        effort: action.effort,
        detail: action.detail(context),
        savingKg: saving,
        impactScore: saving * (EFFORT_WEIGHT[action.effort] ?? 0.8),
      };
    })
    .filter((rec) => rec.savingKg >= MIN_SAVING_KG)
    .sort((a, b) => b.impactScore - a.impactScore);

  const recommendations = candidates.slice(0, limit);

  // Project the footprint with every recommendation applied. The planner caps
  // savings per category, so the total can never go negative or double-count
  // overlapping actions. Sharing this logic keeps the "what-if" UI consistent.
  const allIds = recommendations.map((rec) => rec.id);
  const { projectedTotal, totalSaving } = projectFootprint(footprint, recommendations, allIds);

  return {
    recommendations,
    totalPotentialSaving: totalSaving,
    projectedTotal,
    projectedReductionPct: footprint.total ? Math.round((totalSaving / footprint.total) * 100) : 0,
  };
}

function safeApplies(action, context) {
  try {
    return Boolean(action.applies(context));
  } catch {
    return false;
  }
}

function safeSaving(action, context) {
  try {
    const value = action.saving(context);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}
