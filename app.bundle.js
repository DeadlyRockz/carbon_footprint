(function () {
  'use strict';
  var __cache = {};
  var __factories = {};
  function __def(name, factory) { __factories[name] = factory; }
  function __require(name) {
    if (__cache[name]) return __cache[name].exports;
    var module = { exports: {} };
    __cache[name] = module;
    __factories[name](module, __require);
    return module.exports;
  }
__def("data/emissionFactors", function (module, __require) {
const TRANSPORT_FACTORS = Object.freeze({
  carPetrol: 0.192,
  carDiesel: 0.171,
  carHybrid: 0.12,
  carElectric: 0.05, // depends on grid; uses a typical mixed grid
  bus: 0.097,
  train: 0.035,
  flightShortHaul: 0.158, // < ~1500 km, per passenger-km incl. uplift
  flightLongHaul: 0.15, // > ~1500 km, per passenger-km incl. uplift
});
const GRID_INTENSITY = Object.freeze({
  world: 0.475,
  us: 0.37,
  eu: 0.25,
  uk: 0.21,
  india: 0.71,
  australia: 0.66,
  renewable: 0.02, // certified renewable / green tariff
});
const FLIGHT_TRIP_KM = Object.freeze({
  shortHaul: 1100, // e.g. a return regional/domestic hop
  longHaul: 9000, // e.g. a return intercontinental trip
});
const NATURAL_GAS_FACTOR = 0.183;
const DIET_DAILY = Object.freeze({
  meatHeavy: 7.2, // meat in every meal
  average: 5.6, // typical mixed diet
  lowMeat: 4.7, // meat a few times a week
  pescatarian: 3.9,
  vegetarian: 3.8,
  vegan: 2.9,
});
const SHOPPING_ANNUAL = Object.freeze({
  low: 600, // buys rarely, second-hand, repairs
  average: 1500,
  high: 3200, // frequent new purchases, fast fashion, gadgets
});
const WASTE_ANNUAL = Object.freeze({
  low: 130,
  average: 320,
  high: 600,
});
const RECYCLING_AVOIDED_SHARE = 0.45;
const PERIOD_TO_YEAR = Object.freeze({
  day: 365,
  week: 52,
  month: 12,
  year: 1,
});
const BENCHMARKS = Object.freeze({
  paris2030: 2300,
  sustainable: 2000,
  globalAverage: 4700,
  regional: Object.freeze({
    world: 4700,
    us: 14700,
    eu: 6800,
    uk: 5500,
    india: 1900,
    australia: 15000,
  }),
});
  module.exports = { TRANSPORT_FACTORS, GRID_INTENSITY, FLIGHT_TRIP_KM, NATURAL_GAS_FACTOR, DIET_DAILY, SHOPPING_ANNUAL, WASTE_ANNUAL, RECYCLING_AVOIDED_SHARE, PERIOD_TO_YEAR, BENCHMARKS };
});
__def("core/math", function (module, __require) {
function roundTo(value, dp = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** dp;
  return Math.round(n * factor) / factor;
}
  module.exports = { roundTo };
});
__def("core/format", function (module, __require) {
function formatKg(kg) {
  const n = Math.round(Number(kg) || 0);
  return `${n.toLocaleString('en-US')} kg`;
}
function formatTonnes(kg) {
  const t = (Number(kg) || 0) / 1000;
  return `${t.toFixed(1)} t`;
}
function formatPercent(share) {
  return `${Math.round((Number(share) || 0) * 100)}%`;
}
function treesEquivalent(kg) {
  return Math.max(0, Math.round((Number(kg) || 0) / 21));
}
function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
  module.exports = { formatKg, formatTonnes, formatPercent, treesEquivalent, isoDate };
});
__def("core/calculator", function (module, __require) {
const { TRANSPORT_FACTORS, GRID_INTENSITY, NATURAL_GAS_FACTOR, FLIGHT_TRIP_KM, DIET_DAILY, SHOPPING_ANNUAL, WASTE_ANNUAL, RECYCLING_AVOIDED_SHARE, PERIOD_TO_YEAR } = __require('data/emissionFactors');
const { roundTo } = __require('core/math');
const CATEGORY_LABELS = Object.freeze({
  transport: 'Transport',
  home: 'Home energy',
  diet: 'Food & diet',
  shopping: 'Shopping & goods',
  waste: 'Waste',
});
function createDefaultProfile() {
  return {
    period: 'month',
    transport: {
      carKm: 0,
      carFuel: 'petrol',
      carOccupancy: 1,
      busKm: 0,
      trainKm: 0,
      flightsShortPerYear: 0,
      flightsLongPerYear: 0,
    },
    home: {
      electricityKwh: 0,
      gridRegion: 'world',
      naturalGasKwh: 0,
      householdSize: 1,
    },
    diet: { type: 'average' },
    shopping: { level: 'average' },
    waste: { level: 'average', recycles: false },
  };
}
function toNonNegativeNumber(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}
function annualize(value, period) {
  const multiplier = PERIOD_TO_YEAR[period] ?? PERIOD_TO_YEAR.year;
  return toNonNegativeNumber(value) * multiplier;
}
function pickFactor(map, key, fallbackKey) {
  return map[key] ?? map[fallbackKey];
}
function carEmissionFactor(fuel) {
  return pickFactor(
    {
      petrol: TRANSPORT_FACTORS.carPetrol,
      diesel: TRANSPORT_FACTORS.carDiesel,
      hybrid: TRANSPORT_FACTORS.carHybrid,
      electric: TRANSPORT_FACTORS.carElectric,
    },
    fuel,
    'petrol',
  );
}
function calcTransport(transport, period) {
  const occupancy = Math.max(1, toNonNegativeNumber(transport.carOccupancy, 1));
  const carFactor = carEmissionFactor(transport.carFuel);
  const car = (annualize(transport.carKm, period) * carFactor) / occupancy;
  const bus = annualize(transport.busKm, period) * TRANSPORT_FACTORS.bus;
  const train = annualize(transport.trainKm, period) * TRANSPORT_FACTORS.train;
  const flightShort =
    toNonNegativeNumber(transport.flightsShortPerYear) *
    FLIGHT_TRIP_KM.shortHaul *
    TRANSPORT_FACTORS.flightShortHaul;
  const flightLong =
    toNonNegativeNumber(transport.flightsLongPerYear) *
    FLIGHT_TRIP_KM.longHaul *
    TRANSPORT_FACTORS.flightLongHaul;
  return {
    total: car + bus + train + flightShort + flightLong,
    parts: { car, bus, train, flightShort, flightLong },
  };
}
function calcHome(home, period) {
  const householdSize = Math.max(1, toNonNegativeNumber(home.householdSize, 1));
  const gridFactor = pickFactor(GRID_INTENSITY, home.gridRegion, 'world');
  const electricity = annualize(home.electricityKwh, period) * gridFactor;
  const gas = annualize(home.naturalGasKwh, period) * NATURAL_GAS_FACTOR;
  const total = (electricity + gas) / householdSize;
  return {
    total,
    parts: {
      electricity: electricity / householdSize,
      gas: gas / householdSize,
    },
  };
}
function calcDiet(diet) {
  const daily = pickFactor(DIET_DAILY, diet.type, 'average');
  return { total: daily * 365, parts: { food: daily * 365 } };
}
function calcShopping(shopping) {
  const total = pickFactor(SHOPPING_ANNUAL, shopping.level, 'average');
  return { total, parts: { goods: total } };
}
function calcWaste(waste) {
  const base = pickFactor(WASTE_ANNUAL, waste.level, 'average');
  const total = waste.recycles ? base * (1 - RECYCLING_AVOIDED_SHARE) : base;
  return { total, parts: { waste: total } };
}
function calculateFootprint(profile) {
  const safe = { ...createDefaultProfile(), ...profile };
  const period = PERIOD_TO_YEAR[safe.period] ? safe.period : 'year';
  const transport = calcTransport(safe.transport ?? {}, period);
  const home = calcHome(safe.home ?? {}, period);
  const diet = calcDiet(safe.diet ?? {});
  const shopping = calcShopping(safe.shopping ?? {});
  const waste = calcWaste(safe.waste ?? {});
  const categories = {
    transport: roundTo(transport.total),
    home: roundTo(home.total),
    diet: roundTo(diet.total),
    shopping: roundTo(shopping.total),
    waste: roundTo(waste.total),
  };
  const total = roundTo(transport.total + home.total + diet.total + shopping.total + waste.total);
  return {
    total,
    categories,
    details: { transport, home, diet, shopping, waste },
    period,
  };
}
function rankCategories(footprint) {
  const total = footprint.total || 1;
  return Object.entries(footprint.categories)
    .map(([key, value]) => ({
      key,
      label: CATEGORY_LABELS[key] ?? key,
      value,
      share: value / total,
    }))
    .sort((a, b) => b.value - a.value);
}
  module.exports = { CATEGORY_LABELS, createDefaultProfile, toNonNegativeNumber, annualize, carEmissionFactor, calculateFootprint, rankCategories };
});
__def("core/benchmarks", function (module, __require) {
const { BENCHMARKS } = __require('data/emissionFactors');
const { roundTo: round } = __require('core/math');
const RATING_BANDS = [
  { id: 'excellent', label: 'Excellent', max: BENCHMARKS.sustainable },
  { id: 'good', label: 'Good', max: BENCHMARKS.paris2030 },
  { id: 'fair', label: 'Fair', max: BENCHMARKS.globalAverage },
  { id: 'high', label: 'High', max: BENCHMARKS.globalAverage * 1.75 },
  { id: 'veryHigh', label: 'Very high', max: Infinity },
];
function rateFootprint(totalKg) {
  const total = Math.max(0, Number(totalKg) || 0);
  return RATING_BANDS.find((band) => total <= band.max) ?? RATING_BANDS.at(-1);
}
function ratio(value, reference) {
  if (!reference) return 0;
  return value / reference;
}
function benchmark(totalKg, region = 'world') {
  const total = Math.max(0, Number(totalKg) || 0);
  const regionalAverage = BENCHMARKS.regional[region] ?? BENCHMARKS.globalAverage;
  const rating = rateFootprint(total);
  return {
    totalKg: total,
    totalTonnes: round(total / 1000, 2),
    rating,
    targets: {
      paris2030: BENCHMARKS.paris2030,
      sustainable: BENCHMARKS.sustainable,
    },
    comparisons: {
      vsParis2030: round(ratio(total, BENCHMARKS.paris2030), 2),
      vsGlobalAverage: round(ratio(total, BENCHMARKS.globalAverage), 2),
      vsRegionalAverage: round(ratio(total, regionalAverage), 2),
    },
    gapToParis2030: round(Math.max(0, total - BENCHMARKS.paris2030)),
    regionalAverage,
  };
}
function headline(summary) {
  const { vsGlobalAverage } = summary.comparisons;
  const tonnes = summary.totalTonnes;
  if (summary.rating.id === 'excellent') {
    return `Your estimated footprint is ${tonnes} t CO₂e a year — already within a sustainable range. Keep it up.`;
  }
  if (summary.gapToParis2030 === 0) {
    return `At ${tonnes} t CO₂e a year you're on track for the 2030 climate target. A little more gets you to a fully sustainable level.`;
  }
  const direction = vsGlobalAverage >= 1 ? 'above' : 'below';
  const pct = Math.round(Math.abs(vsGlobalAverage - 1) * 100);
  return `Your estimated footprint is ${tonnes} t CO₂e a year — about ${pct}% ${direction} the global average. To meet the 2030 target you'd cut roughly ${summary.gapToParis2030.toLocaleString()} kg.`;
}
  module.exports = { rateFootprint, benchmark, headline };
});
__def("core/planner", function (module, __require) {
const { roundTo } = __require('core/math');
function projectFootprint(footprint, recommendations, selectedIds) {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  const rawByCategory = {};
  for (const rec of recommendations) {
    if (!selected.has(rec.id)) continue;
    rawByCategory[rec.category] = (rawByCategory[rec.category] ?? 0) + rec.savingKg;
  }
  const savingByCategory = {};
  let totalSaving = 0;
  for (const [category, saved] of Object.entries(rawByCategory)) {
    const capped = Math.min(saved, footprint.categories[category] ?? 0);
    savingByCategory[category] = roundTo(capped);
    totalSaving += capped;
  }
  totalSaving = roundTo(totalSaving);
  return {
    projectedTotal: roundTo(Math.max(0, footprint.total - totalSaving)),
    totalSaving,
    savingByCategory,
  };
}
function autoSelectForTarget(footprint, recommendations, targetKg) {
  if (footprint.total <= targetKg) return [];
  const byImpact = [...recommendations].sort((a, b) => b.savingKg - a.savingKg);
  const selected = [];
  for (const rec of byImpact) {
    selected.push(rec.id);
    if (projectFootprint(footprint, recommendations, selected).projectedTotal <= targetKg) {
      break;
    }
  }
  return selected;
}
function goalStatus(projectedTotal, targetKg) {
  const projected = Math.max(0, Number(projectedTotal) || 0);
  const target = Math.max(0, Number(targetKg) || 0);
  return {
    reached: projected <= target,
    gap: roundTo(Math.max(0, projected - target)),
    overshoot: roundTo(Math.max(0, target - projected)),
    targetKg: target,
  };
}
function goalPresets(footprintTotal, benchmarks) {
  return [
    {
      id: 'paris2030',
      label: '2030 climate target',
      detail: '≈ 2.3 t · the 1.5 °C-aligned per-person budget',
      targetKg: benchmarks.paris2030,
    },
    {
      id: 'halve',
      label: 'Halve my footprint',
      detail: 'A bold, motivating personal cut',
      targetKg: roundTo(footprintTotal / 2),
    },
    {
      id: 'sustainable',
      label: 'Fully sustainable',
      detail: '≈ 2.0 t · long-term net-zero-compatible level',
      targetKg: benchmarks.sustainable,
    },
  ];
}
  module.exports = { projectFootprint, autoSelectForTarget, goalStatus, goalPresets };
});
__def("core/recommendations", function (module, __require) {
const { TRANSPORT_FACTORS, GRID_INTENSITY, FLIGHT_TRIP_KM, DIET_DAILY, SHOPPING_ANNUAL, WASTE_ANNUAL, RECYCLING_AVOIDED_SHARE } = __require('data/emissionFactors');
const { annualize, toNonNegativeNumber, carEmissionFactor, CATEGORY_LABELS } = __require('core/calculator');
const { projectFootprint } = __require('core/planner');
const { roundTo } = __require('core/math');
const EFFORT_WEIGHT = Object.freeze({ low: 1, medium: 0.85, high: 0.7 });
const MIN_SAVING_KG = 40;
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
const ACTIONS = [
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
function recommend(profile, footprint, { limit = 6 } = {}) {
  const context = buildContext(profile, footprint);
  const candidates = ACTIONS.filter((action) => safeApplies(action, context))
    .map((action) => {
      const saving = Math.max(0, roundTo(safeSaving(action, context)));
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
  module.exports = { recommend };
});
__def("core/insights", function (module, __require) {
const { formatKg, formatTonnes, formatPercent } = __require('core/format');
const { BENCHMARKS } = __require('data/emissionFactors');
function coachingNote(footprint, ranked, plan) {
  if (!footprint || footprint.total <= 0) {
    return 'Enter your details above and I’ll build a plan tailored to you.';
  }
  const top = ranked[0];
  const lead = top
    ? `Your biggest lever is ${top.label.toLowerCase()} — ${formatPercent(top.share)} of your footprint.`
    : '';
  if (footprint.total <= BENCHMARKS.sustainable || !plan.recommendations.length) {
    return `${lead} You’re already living within a sustainable range — well done. The most valuable thing now is to keep it steady and help others do the same.`.trim();
  }
  const best = plan.recommendations[0];
  return `${lead} Start with “${best.title}” — on its own it could save about ${formatKg(
    best.savingKg,
  )} a year. Work down the list and you’d reach roughly ${formatTonnes(
    plan.projectedTotal,
  )} a year.`.trim();
}
function goalMessage(status, projectedTotal) {
  if (status.reached) {
    const spare = status.overshoot;
    const tail = spare > 50 ? ` — with ${formatKg(spare)}/yr to spare` : '';
    return `🎉 This plan reaches your goal of ${formatTonnes(status.targetKg)}${tail}. Projected: ${formatTonnes(
      projectedTotal,
    )}/yr.`;
  }
  return `Projected ${formatTonnes(projectedTotal)}/yr — still ${formatKg(
    status.gap,
  )} above your ${formatTonnes(status.targetKg)} goal. Select more actions to close the gap.`;
}
function progressMessage(latestTotal, previousTotal) {
  if (previousTotal == null) {
    return 'First snapshot saved — this is your baseline. Come back after making a change to watch it drop.';
  }
  const diff = previousTotal - latestTotal;
  if (diff > 1) {
    return `Down ${formatKg(diff)} since last time — that’s real progress. Keep going! 🌍`;
  }
  if (diff < -1) {
    return `Up ${formatKg(-diff)} since last time. No worries — pick one action from your plan to reverse it.`;
  }
  return 'About the same as last time. A single new habit from your plan will move the needle.';
}
  module.exports = { coachingNote, goalMessage, progressMessage };
});
__def("core/storage", function (module, __require) {
const PROFILE_KEY = 'ecotrack:profile';
const HISTORY_KEY = 'ecotrack:history';
const MAX_HISTORY = 60; // keep tracking lightweight and bounded
function getStore() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__ecotrack_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}
function readJson(key, fallback) {
  const store = getStore();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  const store = getStore();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function isStorageAvailable() {
  return getStore() !== null;
}
function saveProfile(profile) {
  return writeJson(PROFILE_KEY, profile);
}
function loadProfile() {
  return readJson(PROFILE_KEY, null);
}
function addHistoryEntry(entry) {
  const history = loadHistory();
  const record = {
    date: entry.date,
    total: entry.total,
    categories: entry.categories ?? {},
  };
  const next = [...history, record].slice(-MAX_HISTORY);
  writeJson(HISTORY_KEY, next);
  return next;
}
function loadHistory() {
  const history = readJson(HISTORY_KEY, []);
  return Array.isArray(history) ? history : [];
}
function clearHistory() {
  writeJson(HISTORY_KEY, []);
  return [];
}
  module.exports = { isStorageAvailable, saveProfile, loadProfile, addHistoryEntry, loadHistory, clearHistory };
});
__def("presets", function (module, __require) {
const PRESETS = Object.freeze({
  commuter: {
    period: 'week',
    transport: {
      carKm: 250,
      carFuel: 'petrol',
      carOccupancy: 1,
      busKm: 0,
      trainKm: 0,
      flightsShortPerYear: 1,
      flightsLongPerYear: 0,
    },
    home: { electricityKwh: 60, gridRegion: 'us', naturalGasKwh: 120, householdSize: 3 },
    diet: { type: 'average' },
    shopping: { level: 'average' },
    waste: { level: 'average', recycles: false },
  },
  flyer: {
    period: 'month',
    transport: {
      carKm: 400,
      carFuel: 'petrol',
      carOccupancy: 1,
      busKm: 0,
      trainKm: 0,
      flightsShortPerYear: 6,
      flightsLongPerYear: 3,
    },
    home: { electricityKwh: 350, gridRegion: 'eu', naturalGasKwh: 600, householdSize: 1 },
    diet: { type: 'meatHeavy' },
    shopping: { level: 'high' },
    waste: { level: 'high', recycles: false },
  },
  green: {
    period: 'month',
    transport: {
      carKm: 0,
      carFuel: 'electric',
      carOccupancy: 1,
      busKm: 40,
      trainKm: 120,
      flightsShortPerYear: 0,
      flightsLongPerYear: 0,
    },
    home: { electricityKwh: 150, gridRegion: 'renewable', naturalGasKwh: 0, householdSize: 2 },
    diet: { type: 'vegetarian' },
    shopping: { level: 'low' },
    waste: { level: 'low', recycles: true },
  },
});
  module.exports = { PRESETS };
});
__def("ui/state", function (module, __require) {
const { BENCHMARKS } = __require('data/emissionFactors');
const state = {
  profile: null,
  footprint: null,
  summary: null,
  plan: null,
  presets: [],
  goalId: 'paris2030',
  targetKg: BENCHMARKS.paris2030,
  selected: new Set(),
};
  module.exports = { state };
});
__def("ui/dom", function (module, __require) {
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') throw new Error('innerHTML is intentionally not supported');
    else if (key.startsWith('data-') || key === 'role' || key === 'for')
      node.setAttribute(key, value);
    else if (key === 'aria') {
      for (const [a, v] of Object.entries(value)) node.setAttribute(`aria-${a}`, v);
    } else node[key] = value;
  }
  for (const child of [].concat(children)) if (child != null) node.append(child);
  return node;
}
const $ = (id) => document.getElementById(id);
function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
function scrollIntoViewSafe(node) {
  node?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  });
}
  module.exports = { el, $, prefersReducedMotion, scrollIntoViewSafe };
});
__def("ui/chart", function (module, __require) {
const { roundTo } = __require('core/math');
const SVG_NS = 'http://www.w3.org/2000/svg';
function chartGeometry(values, { width = 320, height = 120, pad = 10 } = {}) {
  const nums = (values ?? []).map((v) => Number(v) || 0);
  if (nums.length === 0) return { points: [], min: 0, max: 0 };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const points = nums.map((v, i) => {
    const x = nums.length === 1 ? width / 2 : pad + (i / (nums.length - 1)) * innerW;
    const y = pad + (1 - (v - min) / span) * innerH;
    return { x: roundTo(x, 2), y: roundTo(y, 2), v };
  });
  return { points, min, max };
}
function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}
function lineChartSVG(values, opts = {}) {
  const width = opts.width ?? 320;
  const height = opts.height ?? 120;
  const { points } = chartGeometry(values, { width, height, pad: 12 });
  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height,
    role: 'img',
    'aria-label': describeSeries(values),
    class: 'trend-svg',
    preserveAspectRatio: 'none',
  });
  if (points.length === 0) return svg;
  if (points.length > 1) {
    const areaD =
      `M ${points[0].x} ${height - 12} ` +
      points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${points.at(-1).x} ${height - 12} Z`;
    svg.append(svgEl('path', { d: areaD, class: 'trend-area' }));
  }
  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  svg.append(svgEl('path', { d: lineD, class: 'trend-line', fill: 'none' }));
  points.forEach((p, i) => {
    svg.append(
      svgEl('circle', {
        cx: p.x,
        cy: p.y,
        r: i === points.length - 1 ? 4 : 2.5,
        class: i === points.length - 1 ? 'trend-dot trend-dot--last' : 'trend-dot',
      }),
    );
  });
  return svg;
}
function describeSeries(values) {
  const nums = (values ?? []).map((v) => Number(v) || 0);
  if (!nums.length) return 'No data yet';
  const latest = nums.at(-1).toFixed(1);
  const first = nums[0].toFixed(1);
  return `Footprint trend over ${nums.length} snapshots, from ${first} to ${latest} tonnes CO2e per year.`;
}
  module.exports = { chartGeometry, lineChartSVG, describeSeries };
});
__def("ui/form", function (module, __require) {
const { createDefaultProfile, toNonNegativeNumber } = __require('core/calculator');
function readProfile(form) {
  const data = new FormData(form);
  const get = (name) => data.get(name);
  return {
    period: get('period') || 'month',
    transport: {
      carKm: toNonNegativeNumber(get('carKm')),
      carFuel: get('carFuel') || 'petrol',
      carOccupancy: Math.max(1, toNonNegativeNumber(get('carOccupancy'), 1)),
      busKm: toNonNegativeNumber(get('busKm')),
      trainKm: toNonNegativeNumber(get('trainKm')),
      flightsShortPerYear: toNonNegativeNumber(get('flightsShortPerYear')),
      flightsLongPerYear: toNonNegativeNumber(get('flightsLongPerYear')),
    },
    home: {
      electricityKwh: toNonNegativeNumber(get('electricityKwh')),
      gridRegion: get('gridRegion') || 'world',
      naturalGasKwh: toNonNegativeNumber(get('naturalGasKwh')),
      householdSize: Math.max(1, toNonNegativeNumber(get('householdSize'), 1)),
    },
    diet: { type: get('dietType') || 'average' },
    shopping: { level: get('shoppingLevel') || 'average' },
    waste: { level: get('wasteLevel') || 'average', recycles: get('recycles') === 'on' },
  };
}
function applyProfile(form, profile) {
  const p = { ...createDefaultProfile(), ...profile };
  const set = (name, value) => {
    const field = form.elements.namedItem(name);
    if (field) field.value = value;
  };
  set('period', p.period);
  set('carKm', p.transport.carKm);
  set('carFuel', p.transport.carFuel);
  set('carOccupancy', p.transport.carOccupancy);
  set('busKm', p.transport.busKm);
  set('trainKm', p.transport.trainKm);
  set('flightsShortPerYear', p.transport.flightsShortPerYear);
  set('flightsLongPerYear', p.transport.flightsLongPerYear);
  set('electricityKwh', p.home.electricityKwh);
  set('gridRegion', p.home.gridRegion);
  set('naturalGasKwh', p.home.naturalGasKwh);
  set('householdSize', p.home.householdSize);
  set('dietType', p.diet.type);
  set('shoppingLevel', p.shopping.level);
  set('wasteLevel', p.waste.level);
  const recycles = form.elements.namedItem('recycles');
  if (recycles) recycles.checked = Boolean(p.waste.recycles);
}
  module.exports = { readProfile, applyProfile };
});
__def("ui/render", function (module, __require) {
const { state } = __require('ui/state');
const { el, $ } = __require('ui/dom');
const { formatKg, formatTonnes, formatPercent, treesEquivalent } = __require('core/format');
const { toNonNegativeNumber } = __require('core/calculator');
const { projectFootprint, autoSelectForTarget, goalStatus } = __require('core/planner');
const { goalMessage } = __require('core/insights');
const { BENCHMARKS } = __require('data/emissionFactors');
const EFFORT_LABEL = Object.freeze({
  low: 'Easy win',
  medium: 'Moderate',
  high: 'Bigger change',
});
function renderBreakdown(footprint, ranked) {
  const list = $('breakdown');
  list.replaceChildren();
  const max = ranked[0]?.value || 1;
  for (const cat of ranked) {
    const pct = max ? Math.round((cat.value / max) * 100) : 0;
    list.append(
      el('li', { class: 'bar-row' }, [
        el('div', { class: 'bar-label' }, [
          el('span', { text: cat.label }),
          el('span', {
            class: 'bar-value',
            text: `${formatKg(cat.value)} · ${formatPercent(cat.share)}`,
          }),
        ]),
        el(
          'div',
          {
            class: 'bar-track',
            role: 'img',
            aria: { label: `${cat.label}: ${formatPercent(cat.share)} of your footprint` },
          },
          el('div', { class: 'bar-fill', style: `width:${pct}%` }),
        ),
      ]),
    );
  }
}
function renderBenchmark(summary) {
  const box = $('benchmark');
  box.replaceChildren();
  box.append(
    el('p', { text: 'How you compare:', style: 'margin:0;font-weight:600;' }),
    el('dl', {}, [
      el('dt', { text: 'vs. 2030 climate target (2.3 t)' }),
      el('dd', { text: `${summary.comparisons.vsParis2030}×` }),
      el('dt', { text: 'vs. global average (4.7 t)' }),
      el('dd', { text: `${summary.comparisons.vsGlobalAverage}×` }),
      el('dt', { text: 'Trees needed to absorb it for a year' }),
      el('dd', { text: treesEquivalent(summary.totalKg).toLocaleString('en-US') }),
    ]),
  );
}
function renderGoalOptions() {
  const wrap = $('goal-options');
  wrap.replaceChildren();
  const options = [
    ...state.presets.map((p) => ({ ...p })),
    { id: 'custom', label: 'Custom', detail: 'Set your own target', targetKg: null },
  ];
  for (const opt of options) {
    const input = el('input', {
      type: 'radio',
      name: 'goal',
      value: opt.id,
      class: 'goal-radio',
      checked: opt.id === state.goalId,
    });
    input.addEventListener('change', () => onGoalChange(opt.id));
    wrap.append(
      el('label', { class: 'goal-option' }, [
        input,
        el('span', { class: 'goal-text' }, [
          el('span', { class: 'goal-name', text: opt.label }),
          el('span', { class: 'goal-detail', text: opt.detail }),
        ]),
      ]),
    );
  }
}
function onGoalChange(goalId) {
  state.goalId = goalId;
  const customWrap = $('custom-goal-wrap');
  if (goalId === 'custom') {
    customWrap.hidden = false;
    const input = $('custom-goal');
    if (!input.value) input.value = (state.targetKg / 1000).toFixed(1);
    state.targetKg = Math.max(0, toNonNegativeNumber(input.value) * 1000);
    input.focus();
  } else {
    customWrap.hidden = true;
    const preset = state.presets.find((p) => p.id === goalId);
    state.targetKg = preset ? preset.targetKg : BENCHMARKS.paris2030;
  }
  reselectForTarget();
  renderRecommendations();
  renderGauge();
}
function reselectForTarget() {
  state.selected = new Set(
    autoSelectForTarget(state.footprint, state.plan.recommendations, state.targetKg),
  );
}
function renderGauge() {
  const { footprint, plan, selected, targetKg } = state;
  const projection = projectFootprint(footprint, plan.recommendations, selected);
  const projected = projection.projectedTotal;
  const status = goalStatus(projected, targetKg);
  const scaleMax = Math.max(footprint.total, targetKg) || 1;
  const pct = (v) => Math.max(0, Math.min(100, (v / scaleMax) * 100));
  const gauge = $('gauge');
  gauge.replaceChildren();
  gauge.append(
    el(
      'div',
      {
        class: 'gauge-track',
        role: 'img',
        aria: {
          label: `Now ${formatTonnes(footprint.total)}, projected ${formatTonnes(
            projected,
          )}, goal ${formatTonnes(targetKg)}.`,
        },
      },
      [
        el('div', { class: 'gauge-current', style: `width:${pct(footprint.total)}%` }),
        el('div', {
          class: `gauge-projected ${status.reached ? 'is-reached' : ''}`,
          style: `width:${pct(projected)}%`,
        }),
        el('div', { class: 'gauge-target', style: `left:${pct(targetKg)}%`, title: 'Goal' }),
      ],
    ),
    el('div', { class: 'gauge-legend' }, [
      el('span', {}, [
        el('b', { text: 'Now ' }),
        document.createTextNode(formatTonnes(footprint.total)),
      ]),
      el('span', { class: 'proj' }, [
        el('b', { text: 'Projected ' }),
        document.createTextNode(formatTonnes(projected)),
      ]),
      el('span', {}, [el('b', { text: 'Goal ' }), document.createTextNode(formatTonnes(targetKg))]),
    ]),
  );
  $('goal-message').textContent = goalMessage(status, projected);
}
function renderRecommendations() {
  const list = $('recommendations');
  list.replaceChildren();
  if (!state.plan.recommendations.length) {
    list.append(
      el('li', { class: 'rec rec--empty' }, [
        el('p', {
          class: 'rec-detail',
          text: 'No high-impact action is left to suggest — your footprint is already low across the board. 🌍',
        }),
      ]),
    );
    return;
  }
  for (const rec of state.plan.recommendations) {
    const on = state.selected.has(rec.id);
    const checkbox = el('input', {
      type: 'checkbox',
      id: `rec-${rec.id}`,
      class: 'rec-check',
      'data-id': rec.id,
      checked: on,
    });
    checkbox.addEventListener('change', (e) => onToggleAction(rec.id, e.target.checked));
    list.append(
      el('li', { class: `rec ${on ? 'rec--on' : ''}`, id: `li-${rec.id}` }, [
        el('div', { class: 'rec-row' }, [
          checkbox,
          el('div', { class: 'rec-body' }, [
            el('div', { class: 'rec-head' }, [
              el('label', { class: 'rec-title', for: `rec-${rec.id}`, text: rec.title }),
              el('span', { class: 'rec-saving', text: `−${formatKg(rec.savingKg)}/yr` }),
            ]),
            el('p', { class: 'rec-detail', text: rec.detail }),
            el('div', { class: 'rec-meta' }, [
              el('span', { class: 'tag', text: rec.categoryLabel }),
              el('span', {
                class: 'tag',
                'data-effort': rec.effort,
                text: EFFORT_LABEL[rec.effort] ?? '',
              }),
            ]),
          ]),
        ]),
      ]),
    );
  }
}
function onToggleAction(id, checked) {
  if (checked) state.selected.add(id);
  else state.selected.delete(id);
  $(`li-${id}`)?.classList.toggle('rec--on', checked);
  renderGauge();
}
  module.exports = { renderBreakdown, renderBenchmark, renderGoalOptions, reselectForTarget, renderGauge, renderRecommendations };
});
__def("ui/tracker", function (module, __require) {
const { el, $ } = __require('ui/dom');
const { formatKg, formatTonnes } = __require('core/format');
const { progressMessage } = __require('core/insights');
const { lineChartSVG } = __require('ui/chart');
function renderHistory(history) {
  const section = $('tracker');
  const list = $('history');
  const trend = $('trend');
  list.replaceChildren();
  trend.replaceChildren();
  if (!history.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const tonnes = history.map((h) => h.total / 1000);
  trend.append(lineChartSVG(tonnes, { height: 130 }));
  $('progress-msg').textContent = progressMessage(
    history.at(-1).total,
    history.length > 1 ? history.at(-2).total : null,
  );
  history
    .slice()
    .reverse()
    .forEach((entry, idx, reversed) => {
      const prev = reversed[idx + 1];
      let delta;
      if (prev) {
        const diff = entry.total - prev.total;
        const down = diff <= 0;
        delta = el('span', {
          class: `h-delta ${down ? 'down' : 'up'}`,
          text: `${down ? '▼' : '▲'} ${formatKg(Math.abs(diff))}`,
        });
      } else {
        delta = el('span', { class: 'h-delta', text: 'baseline' });
      }
      list.append(
        el('li', {}, [
          el('span', { class: 'h-date', text: entry.date }),
          el('span', { class: 'h-total', text: formatTonnes(entry.total) }),
          delta,
        ]),
      );
    });
}
  module.exports = { renderHistory };
});
__def("app", function (module, __require) {
const { calculateFootprint, rankCategories, toNonNegativeNumber } = __require('core/calculator');
const { benchmark, headline } = __require('core/benchmarks');
const { recommend } = __require('core/recommendations');
const { autoSelectForTarget, goalPresets } = __require('core/planner');
const { coachingNote } = __require('core/insights');
const { formatTonnes, isoDate } = __require('core/format');
const { BENCHMARKS } = __require('data/emissionFactors');
const { saveProfile, loadProfile, addHistoryEntry, loadHistory, clearHistory } = __require('core/storage');
const { PRESETS } = __require('presets');
const { state } = __require('ui/state');
const { el, $, scrollIntoViewSafe } = __require('ui/dom');
const { readProfile, applyProfile } = __require('ui/form');
const { renderBreakdown, renderBenchmark, renderGoalOptions, renderGauge, renderRecommendations, reselectForTarget } = __require('ui/render');
const { renderHistory } = __require('ui/tracker');
function computeAndRender(profile) {
  const footprint = calculateFootprint(profile);
  const summary = benchmark(footprint.total, profile.home.gridRegion);
  const plan = recommend(profile, footprint);
  const ranked = rankCategories(footprint);
  state.profile = profile;
  state.footprint = footprint;
  state.summary = summary;
  state.plan = plan;
  state.presets = goalPresets(footprint.total, BENCHMARKS);
  state.goalId = 'paris2030';
  state.targetKg = BENCHMARKS.paris2030;
  state.selected = new Set(autoSelectForTarget(footprint, plan.recommendations, state.targetKg));
  $('custom-goal-wrap').hidden = true; // reset any prior custom-goal state
  $('total-tonnes').textContent = formatTonnes(footprint.total);
  const badge = $('rating-badge');
  badge.textContent = summary.rating.label;
  badge.setAttribute('data-rating', summary.rating.id);
  $('headline').textContent = headline(summary);
  $('coaching').textContent = coachingNote(footprint, ranked, plan);
  renderBreakdown(footprint, ranked);
  renderBenchmark(summary);
  renderGoalOptions();
  renderRecommendations();
  renderGauge();
  const results = $('results');
  results.hidden = false;
  $('sr-status').textContent = `Your estimated footprint is ${formatTonnes(
    footprint.total,
  )} CO₂e per year — rating: ${summary.rating.label}. ${headline(summary)}`;
  results.focus?.();
}
function exportData() {
  const payload = {
    app: 'EcoTrack',
    exportedAt: new Date().toISOString(),
    profile: loadProfile(),
    history: loadHistory(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `ecotrack-${isoDate()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function init() {
  const form = $('footprint-form');
  const saved = loadProfile();
  if (saved) applyProfile(form, saved);
  renderHistory(loadHistory());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const profile = readProfile(form);
    saveProfile(profile);
    computeAndRender(profile);
  });
  form.addEventListener('reset', () => {
    requestAnimationFrame(() => {
      $('results').hidden = true;
      state.footprint = null;
    });
  });
  for (const chip of document.querySelectorAll('[data-preset]')) {
    chip.addEventListener('click', () => {
      const preset = PRESETS[chip.dataset.preset];
      if (!preset) return;
      applyProfile(form, preset);
      saveProfile(preset);
      computeAndRender(preset);
      scrollIntoViewSafe($('results'));
    });
  }
  $('custom-goal').addEventListener('input', (e) => {
    if (state.goalId !== 'custom') return;
    state.targetKg = Math.max(0, toNonNegativeNumber(e.target.value) * 1000);
    reselectForTarget();
    renderRecommendations();
    renderGauge();
  });
  $('save-entry').addEventListener('click', () => {
    if (!state.footprint) return;
    const history = addHistoryEntry({
      date: isoDate(),
      total: state.footprint.total,
      categories: state.footprint.categories,
    });
    renderHistory(history);
    scrollIntoViewSafe($('tracker'));
  });
  $('clear-history').addEventListener('click', () => renderHistory(clearHistory()));
  $('export-data').addEventListener('click', exportData);
  setupInstallPrompt();
  registerServiceWorker();
}
function setupInstallPrompt() {
  const installBtn = $('install');
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
  });
}
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
});
  __require('app');
})();