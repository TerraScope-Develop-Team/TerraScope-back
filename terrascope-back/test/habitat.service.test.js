import test from 'node:test';
import assert from 'node:assert/strict';

import { validateHabitatInput } from '../src/services/habitat.service.js';

test('validateHabitatInput requiere nombre y descripcion', () => {
  assert.throws(() => validateHabitatInput({ nombre_habitat: '' }), /Nombre y descripción/);
  assert.throws(() => validateHabitatInput({ descripcion_habitat: 'x' }), /Nombre y descripción/);
});

test('validateHabitatInput normaliza datos válidos', () => {
  const normalized = validateHabitatInput({
    nombre_habitat: '  Bosque  ',
    descripcion_habitat: '  Lugar húmedo  ',
  });

  assert.deepEqual(normalized, {
    nombre_habitat: 'Bosque',
    descripcion_habitat: 'Lugar húmedo',
  });
});
