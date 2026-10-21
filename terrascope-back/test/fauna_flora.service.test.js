import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildComentarioPayload,
  buildFaunaFloraFilter,
  formatAvistamientoMetrics,
  selectAvistamientoRecommendations,
  validateFaunaFloraInput,
} from '../src/services/fauna_flora.service.js';

test('validateFaunaFloraInput exige habitat, ubicacion y campos obligatorios', () => {
  assert.throws(
    () => validateFaunaFloraInput({
      nombre_comun: 'Jaguar',
      nombre_cientifico: 'Panthera onca',
      especie: 'Panthera onca',
      tipo: 'Fauna',
      ubicacion: { latitud: 19.4, longitud: -99.1 },
    }),
    /Habitat es requerido/
  );

  assert.throws(
    () => validateFaunaFloraInput({
      habitat: { id_habitat: '507f1f77bcf86cd799439011' },
      nombre_comun: 'Jaguar',
      nombre_cientifico: 'Panthera onca',
      especie: 'Panthera onca',
      tipo: 'Fauna',
      ubicacion: { latitud: 19.4 },
    }),
    /Ubicación es requerida/
  );
});

test('buildFaunaFloraFilter normaliza búsqueda y cursor', () => {
  const filter = buildFaunaFloraFilter({
    especie: 'Jaguar',
    buscar: '  León  ',
    cursor: '507f1f77bcf86cd799439011',
  });

  assert.equal(filter.especie, 'Jaguar');
  assert.deepEqual(filter.OR, [
    { nombre_comun: { contains: 'León', mode: 'insensitive' } },
    { nombre_cientifico: { contains: 'León', mode: 'insensitive' } },
    { especie: { contains: 'León', mode: 'insensitive' } },
  ]);
  assert.deepEqual(filter.id, { lt: '507f1f77bcf86cd799439011' });
});

test('formatAvistamientoMetrics agrega contadores sociales', () => {
  const formatted = formatAvistamientoMetrics(
    {
      id: 'a1',
      likes: ['u1', 'u2'],
      comentarios: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
    },
    'u2'
  );

  assert.equal(formatted.total_likes, 2);
  assert.equal(formatted.total_comentarios, 3);
  assert.equal(formatted.user_has_liked, true);
});

test('selectAvistamientoRecommendations incluye avistamientos dentro de un kilómetro', () => {
  const origin = {
    id: 'origin',
    especie: 'Jaguar',
    ubicacion: { latitud: 19.4, longitud: -99.1 },
  };
  const candidates = [
    {
      id: 'within-radius',
      especie: 'Pino',
      ubicacion: { latitud: 19.408, longitud: -99.1 },
    },
    {
      id: 'outside-radius',
      especie: 'Pino',
      ubicacion: { latitud: 19.41, longitud: -99.1 },
    },
    {
      id: 'near',
      especie: 'Pino',
      ubicacion: { latitud: 19.4001, longitud: -99.1 },
    },
    {
      ...origin,
    },
  ];

  const result = selectAvistamientoRecommendations(origin, candidates);

  assert.equal(result.criterio, 'cercania');
  assert.equal(result.recomendaciones[0].id, 'near');
  assert.deepEqual(
    result.recomendaciones.map(({ id }) => id),
    ['near', 'within-radius'],
  );
  assert.equal(Math.round(result.recomendaciones[0].distanceMeters), 11);
});

test('selectAvistamientoRecommendations usa la especie cuando no hay cercanos', () => {
  const origin = {
    id: 'origin',
    especie: 'Jaguar',
    ubicacion: { latitud: 19.4, longitud: -99.1 },
  };
  const candidates = [
    {
      id: 'same-species',
      especie: 'Jaguar',
      ubicacion: { latitud: 19.5, longitud: -99.1 },
    },
    {
      id: 'other-species',
      especie: 'Pino',
      ubicacion: { latitud: 19.5, longitud: -99.1 },
    },
  ];

  assert.deepEqual(selectAvistamientoRecommendations(origin, candidates), {
    criterio: 'especie',
    recomendaciones: [{ id: 'same-species', distanceMeters: null }],
  });
});

test('buildComentarioPayload normaliza un comentario válido', () => {
  const payload = buildComentarioPayload({
    comentario: '  Excelente avistamiento  ',
    autorId: '507f1f77bcf86cd799439011',
    autorNombre: 'Ana',
    autorAvatar: 'avatar.png',
  });

  assert.equal(payload.comentario, 'Excelente avistamiento');
  assert.equal(payload.nombre_usuario, 'Ana');
  assert.equal(payload.id_usuario, '507f1f77bcf86cd799439011');
  assert.equal(payload.imagen_perfil, 'avatar.png');
});
