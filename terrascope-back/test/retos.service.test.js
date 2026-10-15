import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProgresoReto,
  buildRetoManualData,
  buildTop3Leaderboard,
  enrichUserLogros,
  isValidObjectId,
  toggleLogroVisibility,
  validateRetoInscripcion,
} from '../src/services/retos.service.js';

test('isValidObjectId valida IDs de Mongo', () => {
  assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true);
  assert.equal(isValidObjectId('abcd'), false);
  assert.equal(isValidObjectId('507f1f77bcf86cd79943901Z'), false);
});

test('buildTop3Leaderboard ordena y completa con usuarios', () => {
  const reto = {
    nombre_reto: 'Reto de aves',
    usuarios_finalizados: [
      { usuario_id: 'u2', posicion: 2, fecha_completado: '2024-01-02' },
      { usuario_id: 'u1', posicion: 1, fecha_completado: '2024-01-01' },
      { usuario_id: 'u3', posicion: 3, fecha_completado: '2024-01-03' },
    ],
  };

  const users = [
    { id: 'u1', nombre_usuario: 'Ana', imagen_perfil: 'a.jpg' },
    { id: 'u3', nombre_usuario: 'Beto', imagen_perfil: 'b.jpg' },
  ];

  assert.deepEqual(buildTop3Leaderboard(reto, users), [
    {
      usuario: { id: 'u1', nombre_usuario: 'Ana', imagen_perfil: 'a.jpg' },
      posicion: 1,
      fecha_completado: '2024-01-01',
    },
    {
      usuario: { id: 'u3', nombre_usuario: 'Beto', imagen_perfil: 'b.jpg' },
      posicion: 3,
      fecha_completado: '2024-01-03',
    },
  ]);
});

test('enrichUserLogros mezcla logros con su reto base', () => {
  const logros = [
    { id: 'l1', id_reto_base: 'r1', nombre_logro: 'Reto 1', es_mostrado: true },
  ];

  const retos = [
    { id: 'r1', nombre_reto: 'Bosque', descripcion_reto: 'Descubre especies del bosque' },
  ];

  assert.deepEqual(enrichUserLogros(logros, retos), [
    {
      id: 'l1',
      id_reto_base: {
        id: 'r1',
        nombre_reto: 'Bosque',
        descripcion_reto: 'Descubre especies del bosque',
      },
      nombre_logro: 'Reto 1',
      es_mostrado: true,
    },
  ]);
});

test('toggleLogroVisibility alterna la visibilidad del logro', () => {
  const logros = [
    { id: 'l1', nombre_logro: 'Primero', es_mostrado: true },
    { id: 'l2', nombre_logro: 'Segundo', es_mostrado: false },
  ];

  const result = toggleLogroVisibility(logros, 'l2');
  assert.equal(result[1].es_mostrado, true);
  assert.equal(result[0].es_mostrado, true);
});

test('buildProgresoReto calcula porcentaje actual y requerido por categoría', () => {
  const usuario = {
    historial: {
      fauna: {
        Ave: 2,
      },
    },
  };

  const reto = {
    id: 'r1',
    nombre_reto: 'Reto de aves',
    descripcion_reto: 'Observa aves',
    condiciones: {
      fauna: {
        Ave: 5,
      },
    },
  };

  assert.deepEqual(buildProgresoReto({ usuario, reto }), {
    fauna: {
      actual: 2,
      requerido: 5,
      porcentaje: 40,
    },
  });
});

test('validateRetoInscripcion valida IDs de reto y usuario', () => {
  assert.deepEqual(validateRetoInscripcion({ retoId: '507f1f77bcf86cd799439011', usuarioId: '507f1f77bcf86cd799439012' }), {
    retoId: '507f1f77bcf86cd799439011',
    usuarioId: '507f1f77bcf86cd799439012',
  });

  assert.throws(() => validateRetoInscripcion({ retoId: 'bad', usuarioId: '507f1f77bcf86cd799439012' }), /ID de reto válido/);
});

test('buildRetoManualData normaliza el payload de creación manual', () => {
  const result = buildRetoManualData({
    nombre_reto: 'Reto de aves',
    descripcion_reto: 'Observa aves',
    fecha_inicio: '2025-01-01T00:00:00.000Z',
    condiciones: { fauna: { Ave: 3 } },
    es_temporal: true,
  });

  assert.equal(result.nombre_reto, 'Reto de aves');
  assert.equal(result.descripcion_reto, 'Observa aves');
  assert.equal(result.estado, 'activo');
  assert.equal(result.es_temporal, true);
  assert.ok(result.fecha_final instanceof Date);
});
