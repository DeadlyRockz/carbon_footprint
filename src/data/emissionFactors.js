/**
 * Emission factors and reference data for footprint calculations.
 *
 * All values are expressed in kg CO2e (carbon-dioxide equivalent) and are
 * rounded, well-published averages intended for personal estimation — not
 * audit-grade accounting. Sources are noted inline so the assumptions are
 * transparent and easy to update.
 *
 * Primary references:
 *  - UK DEFRA / DESNZ Greenhouse Gas Conversion Factors (2023)
 *  - IEA electricity grid intensity data (2022)
 *  - Poore & Nemecek (2018), "Reducing food's environmental impacts" (Science)
 *  - Our World in Data, per-capita emissions datasets
 *
 * Because these are public averages, individual results are estimates. The UI
 * communicates this clearly to avoid over-claiming precision.
 */

/** Transport emission factors in kg CO2e per passenger-km. */
export const TRANSPORT_FACTORS = Object.freeze({
  carPetrol: 0.192,
  carDiesel: 0.171,
  carHybrid: 0.12,
  carElectric: 0.05, // depends on grid; uses a typical mixed grid
  bus: 0.097,
  train: 0.035,
  flightShortHaul: 0.158, // < ~1500 km, per passenger-km incl. uplift
  flightLongHaul: 0.15, // > ~1500 km, per passenger-km incl. uplift
});

/**
 * Electricity grid intensity in kg CO2e per kWh, selectable by region so the
 * estimate reflects where the user actually lives.
 */
export const GRID_INTENSITY = Object.freeze({
  world: 0.475,
  us: 0.37,
  eu: 0.25,
  uk: 0.21,
  india: 0.71,
  australia: 0.66,
  renewable: 0.02, // certified renewable / green tariff
});

/**
 * Typical round-trip distances (km) used to turn an annual flight *count* into
 * distance. Asking "how many flights a year" is far easier for users than
 * asking for kilometres, and flights are annual events rather than monthly.
 */
export const FLIGHT_TRIP_KM = Object.freeze({
  shortHaul: 1100, // e.g. a return regional/domestic hop
  longHaul: 9000, // e.g. a return intercontinental trip
});

/** Natural gas for heating/cooking, kg CO2e per kWh of gas burned. */
export const NATURAL_GAS_FACTOR = 0.183;

/**
 * Diet footprints in kg CO2e per day, covering food production only.
 * Derived from Poore & Nemecek dietary archetypes.
 */
export const DIET_DAILY = Object.freeze({
  meatHeavy: 7.2, // meat in every meal
  average: 5.6, // typical mixed diet
  lowMeat: 4.7, // meat a few times a week
  pescatarian: 3.9,
  vegetarian: 3.8,
  vegan: 2.9,
});

/**
 * Consumption (clothing, electronics, goods & services) annual footprint in
 * kg CO2e, approximated by spending level since item-level tracking is
 * impractical for a quick self-assessment.
 */
export const SHOPPING_ANNUAL = Object.freeze({
  low: 600, // buys rarely, second-hand, repairs
  average: 1500,
  high: 3200, // frequent new purchases, fast fashion, gadgets
});

/** Household waste annual footprint in kg CO2e by volume level. */
export const WASTE_ANNUAL = Object.freeze({
  low: 130,
  average: 320,
  high: 600,
});

/** Recycling + composting avoids roughly this share of waste emissions. */
export const RECYCLING_AVOIDED_SHARE = 0.45;

/** Multipliers to convert an input period into a yearly figure. */
export const PERIOD_TO_YEAR = Object.freeze({
  day: 365,
  week: 52,
  month: 12,
  year: 1,
});

/**
 * Reference points for benchmarking, in kg CO2e per person per year.
 *  - paris2030: per-capita budget consistent with the 1.5 °C pathway by 2030.
 *  - sustainable: long-term per-capita target compatible with net zero.
 */
export const BENCHMARKS = Object.freeze({
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
