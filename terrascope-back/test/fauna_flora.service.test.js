import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildComentarioPayload,
  buildFaunaFloraFilter,
  evaluarResolucionVotacion,
  formatAvistamientoMetrics,
  normalizeTipoVoto,
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

test('validateFaunaFloraInput inicializa ventana de tiempo y contadores de votos', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');
  const result = validateFaunaFloraInput(
    {
      habitat: { id_habitat: '507f1f77bcf86cd799439011' },
      nombre_comun: 'Jaguar',
      nombre_cientifico: 'Panthera onca',
      especie: 'Mamifero',
      tipo: 'Fauna',
      ubicacion: { latitud: 19.4, longitud: -99.1 },
    },
    now
  );

  assert.equal(result.validacion.estado, 'pendiente');
  assert.equal(result.validacion.votos_positivos, 0);
  assert.equal(result.validacion.votos_negativos, 0);
  assert.equal(result.validacion.fecha_inicio_votacion.toISOString(), now.toISOString());
  assert.ok(result.validacion.fecha_fin_votacion.getTime() > now.getTime());
});

test('normalizeTipoVoto reconoce votos positivos, negativos y rechaza inválidos', () => {
  assert.equal(normalizeTipoVoto(), 'positivo');
  assert.equal(normalizeTipoVoto('positivo'), 'positivo');
  assert.equal(normalizeTipoVoto(true), 'positivo');
  assert.equal(normalizeTipoVoto('negativo'), 'negativo');
  assert.equal(normalizeTipoVoto(false), 'negativo');
  assert.throws(() => normalizeTipoVoto('invalido'), /tipo de voto debe ser/);
});

test('evaluarResolucionVotacion elimina inmediatamente si alcanza umbral de votos negativos en mayoría', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');
  const fin = new Date('2026-10-16T12:00:00.000Z');

  const res = evaluarResolucionVotacion(
    {
      validacion: {
        estado: 'pendiente',
        votos_positivos: 2,
        votos_negativos: 5,
        requeridos_comunidad: 5,
        fecha_inicio_votacion: now,
        fecha_fin_votacion: fin,
      },
    },
    now
  );

  assert.equal(res.accion, 'eliminar');
  assert.equal(res.motivo, 'mayoria_negativa');
});

test('evaluarResolucionVotacion mantiene pendiente durante el periodo aunque tenga muchos votos positivos rápidos', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');
  const fin = new Date('2026-10-16T12:00:00.000Z');

  const res = evaluarResolucionVotacion(
    {
      validacion: {
        estado: 'pendiente',
        votos_positivos: 6,
        votos_negativos: 1,
        requeridos_comunidad: 5,
        fecha_inicio_votacion: now,
        fecha_fin_votacion: fin,
      },
    },
    now
  );

  assert.equal(res.accion, 'ninguna');
  assert.equal(res.estado, 'pendiente');
});

test('evaluarResolucionVotacion al vencer periodo: sin votos por ambos lados se elimina automáticamente', () => {
  const inicio = new Date('2026-10-14T12:00:00.000Z');
  const fin = new Date('2026-10-15T12:00:00.000Z');
  const now = new Date('2026-10-15T12:01:00.000Z');

  const res = evaluarResolucionVotacion(
    {
      validacion: {
        estado: 'pendiente',
        votos_positivos: 0,
        votos_negativos: 0,
        requeridos_comunidad: 5,
        fecha_inicio_votacion: inicio,
        fecha_fin_votacion: fin,
      },
    },
    now
  );

  assert.equal(res.accion, 'eliminar');
  assert.equal(res.motivo, 'sin_votos');
});

test('evaluarResolucionVotacion al vencer periodo: mayoría negativa se elimina y mayoría positiva valida', () => {
  const inicio = new Date('2026-10-14T12:00:00.000Z');
  const fin = new Date('2026-10-15T12:00:00.000Z');
  const now = new Date('2026-10-15T12:01:00.000Z');

  const resNegativa = evaluarResolucionVotacion(
    {
      validacion: {
        estado: 'pendiente',
        votos_positivos: 1,
        votos_negativos: 3,
        requeridos_comunidad: 5,
        fecha_inicio_votacion: inicio,
        fecha_fin_votacion: fin,
      },
    },
    now
  );
  assert.equal(resNegativa.accion, 'eliminar');
  assert.equal(resNegativa.motivo, 'mayoria_negativa');

  const resPositiva = evaluarResolucionVotacion(
    {
      validacion: {
        estado: 'pendiente',
        votos_positivos: 3,
        votos_negativos: 1,
        requeridos_comunidad: 5,
        fecha_inicio_votacion: inicio,
        fecha_fin_votacion: fin,
      },
    },
    now
  );
  assert.equal(resPositiva.accion, 'validar_comunidad');
  assert.equal(resPositiva.estado, 'validado_comunidad');
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
