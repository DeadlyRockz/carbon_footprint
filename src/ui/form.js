/**
 * Form <-> profile mapping.
 *
 * The two functions here are the only place that knows how the HTML form maps
 * onto the calculator's Profile shape, keeping that knowledge out of both the
 * controller and the calculation engine. readProfile() also sanitises every
 * numeric field at the boundary so the engines downstream can trust their input.
 */

import { createDefaultProfile, toNonNegativeNumber } from '../core/calculator.js';

/** Read the form's current values into a sanitised Profile. */
export function readProfile(form) {
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

/** Populate the form fields from a (possibly partial) Profile. */
export function applyProfile(form, profile) {
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
