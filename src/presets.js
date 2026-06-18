/**
 * Quick-start example profiles. They let a first-time visitor see a meaningful
 * result (and a tailored plan) in one click, then tweak from there — a big win
 * for real-world usability and for demoing the assistant.
 *
 * Each preset matches the profile shape from calculator.createDefaultProfile().
 */

export const PRESETS = Object.freeze({
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
