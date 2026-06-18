/**
 * Footprint calculation engine.
 *
 * Pure, dependency-free functions that turn a structured activity profile into
 * an annualized CO2e breakdown. Keeping this layer pure makes it trivial to
 * unit test and lets the exact same logic run in the browser and in Node.
 */

import {
  TRANSPORT_FACTORS,
  GRID_INTENSITY,
  NATURAL_GAS_FACTOR,
  FLIGHT_TRIP_KM,
  DIET_DAILY,
  SHOPPING_ANNUAL,
  WASTE_ANNUAL,
  RECYCLING_AVOIDED_SHARE,
  PERIOD_TO_YEAR,
} from '../data/emissionFactors.js';

/** Human-readable labels for each footprint category. */
export const CATEGORY_LABELS = Object.freeze({
  transport: 'Transport',
  home: 'Home energy',
  diet: 'Food & diet',
  shopping: 'Shopping & goods',
  waste: 'Waste',
});

/**
 * Build a blank profile with sensible defaults. Centralising the shape here
 * keeps the UI, calculator, and tests in agreement about the data model.
 */
export function createDefaultProfile() {
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

/**
 * Coerce any user-supplied value into a safe, finite, non-negative number.
 * This is a small but important guard: form inputs arrive as strings and can
 * be blank, negative, or non-numeric. Defaulting to 0 keeps the math stable.
 */
export function toNonNegativeNumber(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Convert a per-period activity value into a yearly figure. */
export function annualize(value, period) {
  const multiplier = PERIOD_TO_YEAR[period] ?? PERIOD_TO_YEAR.year;
  return toNonNegativeNumber(value) * multiplier;
}

function pickFactor(map, key, fallbackKey) {
  return map[key] ?? map[fallbackKey];
}

/** Annual transport emissions (kg CO2e) from the transport sub-profile. */
function calcTransport(transport, period) {
  const occupancy = Math.max(1, toNonNegativeNumber(transport.carOccupancy, 1));
  const carFactor = pickFactor(
    {
      petrol: TRANSPORT_FACTORS.carPetrol,
      diesel: TRANSPORT_FACTORS.carDiesel,
      hybrid: TRANSPORT_FACTORS.carHybrid,
      electric: TRANSPORT_FACTORS.carElectric,
    },
    transport.carFuel,
    'petrol',
  );

  const car = (annualize(transport.carKm, period) * carFactor) / occupancy;
  const bus = annualize(transport.busKm, period) * TRANSPORT_FACTORS.bus;
  const train = annualize(transport.trainKm, period) * TRANSPORT_FACTORS.train;

  // Flights are entered as annual trip counts, so they are NOT period-scaled.
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

/** Annual home-energy emissions (kg CO2e), apportioned per household member. */
function calcHome(home, period) {
  const householdSize = Math.max(1, toNonNegativeNumber(home.householdSize, 1));
  const gridFactor = pickFactor(GRID_INTENSITY, home.gridRegion, 'world');

  const electricity = annualize(home.electricityKwh, period) * gridFactor;
  const gas = annualize(home.naturalGasKwh, period) * NATURAL_GAS_FACTOR;

  // Household energy is shared, so attribute a per-person slice.
  const total = (electricity + gas) / householdSize;
  return {
    total,
    parts: {
      electricity: electricity / householdSize,
      gas: gas / householdSize,
    },
  };
}

/** Annual diet emissions (kg CO2e) from the chosen dietary archetype. */
function calcDiet(diet) {
  const daily = pickFactor(DIET_DAILY, diet.type, 'average');
  return { total: daily * 365, parts: { food: daily * 365 } };
}

/** Annual consumption emissions (kg CO2e) from spending level. */
function calcShopping(shopping) {
  const total = pickFactor(SHOPPING_ANNUAL, shopping.level, 'average');
  return { total, parts: { goods: total } };
}

/** Annual waste emissions (kg CO2e), reduced when the user recycles/composts. */
function calcWaste(waste) {
  const base = pickFactor(WASTE_ANNUAL, waste.level, 'average');
  const total = waste.recycles ? base * (1 - RECYCLING_AVOIDED_SHARE) : base;
  return { total, parts: { waste: total } };
}

/**
 * Calculate a full annual footprint from a profile.
 *
 * @returns {{
 *   total: number,
 *   categories: Record<string, number>,
 *   details: Record<string, { total: number, parts: Record<string, number> }>,
 *   period: string
 * }} all emissions in kg CO2e per year.
 */
export function calculateFootprint(profile) {
  const safe = { ...createDefaultProfile(), ...profile };
  const period = PERIOD_TO_YEAR[safe.period] ? safe.period : 'year';

  const transport = calcTransport(safe.transport ?? {}, period);
  const home = calcHome(safe.home ?? {}, period);
  const diet = calcDiet(safe.diet ?? {});
  const shopping = calcShopping(safe.shopping ?? {});
  const waste = calcWaste(safe.waste ?? {});

  const categories = {
    transport: round(transport.total),
    home: round(home.total),
    diet: round(diet.total),
    shopping: round(shopping.total),
    waste: round(waste.total),
  };

  const total = round(
    transport.total + home.total + diet.total + shopping.total + waste.total,
  );

  return {
    total,
    categories,
    details: { transport, home, diet, shopping, waste },
    period,
  };
}

/**
 * Rank categories from largest to smallest contributor, with each category's
 * share of the total. This is the backbone of the recommendation engine's
 * "focus on what matters most" logic.
 */
export function rankCategories(footprint) {
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

function round(n) {
  return Math.round(n * 10) / 10;
}
