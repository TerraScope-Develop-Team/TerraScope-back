import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreferenceUpdate,
  normalizeToken,
  validateCoordinates,
} from '../src/services/notificacion.service.js';

test('normalizeToken limpia tokens válidos y rechaza cadenas inválidas', () => {
  assert.equal(normalizeToken('  abcdef1234567890  '), 'abcdef1234567890');
  assert.equal(normalizeToken('   hola mundo   '), null);
  assert.equal(normalizeToken('abc'), null);
});

test('validateCoordinates acepta lat/long válidas', () => {
  assert.equal(validateCoordinates({ latitud: 19.4, longitud: -99.1, precision_ubicacion_m: 10 }), true);
  assert.equal(validateCoordinates({ latitud: 100, longitud: -99.1, precision_ubicacion_m: 10 }), false);
  assert.equal(validateCoordinates({ latitud: 19.4, longitud: -99.1, precision_ubicacion_m: -1 }), false);
});

test('buildPreferenceUpdate solo acepta preferencias permitidas', () => {
  const update = buildPreferenceUpdate({
    avistamientos_cercanos: true,
    retos_por_vencer: false,
    actividad_avistamientos: true,
    otra: true,
  });

  assert.deepEqual(update, {
    avistamientos_cercanos: true,
    retos_por_vencer: false,
    actividad_avistamientos: true,
  });
});
