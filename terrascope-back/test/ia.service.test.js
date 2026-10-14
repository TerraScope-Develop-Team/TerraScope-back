import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIdentificationPrompt,
  buildValidationPrompt,
  parseJsonResponse,
  validateContextualValidationInput,
  validateIdentificationInput,
} from '../src/services/ia.service.js';

test('parseJsonResponse elimina bloques markdown y parsea JSON válido', () => {
  const raw = '```json\n{ "nombre_comun": "Jaguar", "nombre_cientifico": "Panthera onca", "nivel_confianza": "Alto" }\n```';

  assert.deepEqual(parseJsonResponse(raw), {
    nombre_comun: 'Jaguar',
    nombre_cientifico: 'Panthera onca',
    nivel_confianza: 'Alto',
  });
});

test('validateIdentificationInput exige una imagen base64', () => {
  assert.deepEqual(validateIdentificationInput({ imagen: 'data:image/jpeg;base64,abc' }), {
    imagen: 'data:image/jpeg;base64,abc',
  });

  assert.throws(() => validateIdentificationInput({}), /No se recibió ninguna imagen/);
});

test('validateContextualValidationInput requiere campos obligatorios', () => {
  assert.deepEqual(
    validateContextualValidationInput({
      nombre_comun: 'Loro',
      nombre_cientifico: 'Amazona aestiva',
      especie: 'ave',
      descripcion: 'Pájaro de color verde',
      habitat: { nombre_habitat: 'Selva' },
    }),
    {
      nombre_comun: 'Loro',
      nombre_cientifico: 'Amazona aestiva',
      especie: 'ave',
      descripcion: 'Pájaro de color verde',
      habitat: { nombre_habitat: 'Selva' },
    }
  );

  assert.throws(
    () => validateContextualValidationInput({ descripcion: 'sin datos' }),
    /Faltan campos obligatorios/
  );
});

test('buildValidationPrompt incluye los datos clave para validación', () => {
  const prompt = buildValidationPrompt({
    nombre_comun: 'Loro',
    nombre_cientifico: 'Amazona aestiva',
    tipo: 'Fauna',
    especie: 'Ave',
    descripcion: 'Pájaro tropical',
    comportamiento: 'Vuela en grupos',
    estado_extincion: 'No amenazado',
    habitat: { nombre_habitat: 'Selva', descripcion_habitat: 'Bosque tropical' },
  });

  assert.match(prompt, /Nombre común: Loro/);
  assert.match(prompt, /Hábitat: Selva/);
  assert.match(prompt, /Devuelve únicamente un JSON válido/);
});

test('buildIdentificationPrompt describe la tarea de análisis de especie', () => {
  const prompt = buildIdentificationPrompt();

  assert.match(prompt, /Eres un experto en biología y taxonomía/);
  assert.match(prompt, /nombre_cientifico/);
});
