import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDistance,
  normalizeAlertCoordinates,
  buildAlertState,
  buildAlertSummary,
  buildSosAlertData,
  buildUserLocationUpdateData,
  buildAlertSettingsUpdate,
  isValidAlertId,
  buildReadAlertState,
} from '../src/services/alerta.service.js';

test('calculateDistance devuelve distancia en km entre coordenadas', () => {
  const distancia = calculateDistance(19.4326, -99.1332, 19.435, -99.13);
  assert.ok(distancia > 0);
  assert.ok(distancia < 1);
});

test('normalizeAlertCoordinates valida ubicación', () => {
  assert.equal(normalizeAlertCoordinates({ latitud: 19.4, longitud: -99.1 }), true);
  assert.equal(normalizeAlertCoordinates({ latitud: 91, longitud: -99.1 }), false);
  assert.equal(normalizeAlertCoordinates({ latitud: 19.4, longitud: 181 }), false);
});

test('buildAlertState crea el estado de una alerta', () => {
  const state = buildAlertState('alert-1', 'user-1', true);
  assert.deepEqual(state, {
    id: 'alert-1_user-1',
    id_alerta: 'alert-1',
    id_usuario: 'user-1',
    mostrada: true,
    leida: false,
  });
});

test('buildAlertSummary agrega flags mostrada y leida', () => {
  const alerts = [
    { id: 'a1', especie: 'Jaguar', usuarios_notificados: ['u2'] },
  ];
  const states = new Map([['a1', { mostrada: true, leida: false }]]);

  assert.deepEqual(buildAlertSummary(alerts, states), [{
    id: 'a1',
    especie: 'Jaguar',
    usuarios_notificados: ['u2'],
    mostrada: true,
    leida: false,
  }]);
});

test('buildSosAlertData y buildUserLocationUpdateData producen payloads de alerta y ubicación', () => {
  const sos = buildSosAlertData({ userId: 'u1', latitud: 19.4, longitud: -99.1 });
  const locationUpdate = buildUserLocationUpdateData({ latitud: 19.4, longitud: -99.1 });

  assert.deepEqual(sos, {
    id_usuario: 'u1',
    latitud: 19.4,
    longitud: -99.1,
    estado: 'pendiente',
  });

  assert.equal(locationUpdate.ultima_ubicacion_lat, 19.4);
  assert.equal(locationUpdate.ultima_ubicacion_lng, -99.1);
  assert.ok(locationUpdate.ultima_actualizacion_ubicacion instanceof Date);
});

test('buildAlertSettingsUpdate e isValidAlertId validan el contrato de alertas', () => {
  assert.deepEqual(buildAlertSettingsUpdate({ recibir_alertas_peligro: false }), {
    recibir_alertas_peligro: false,
  });

  assert.equal(isValidAlertId('507f1f77bcf86cd799439011'), true);
  assert.equal(isValidAlertId('invalid'), false);
  assert.deepEqual(buildReadAlertState('a1', 'u1'), {
    id: 'a1_u1',
    id_alerta: 'a1',
    id_usuario: 'u1',
    mostrada: true,
    leida: true,
  });
});
