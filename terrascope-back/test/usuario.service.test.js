import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUserProfileResponse,
  buildUserUpdateData,
  normalizeLoginPayload,
  serializeUsuario,
} from '../src/services/usuario.service.js';

test('normalizeLoginPayload valida email y contraseña', () => {
  assert.deepEqual(normalizeLoginPayload({ email_usuario: 'a@b.com', contrasenia_usuario: '123' }), {
    email_usuario: 'a@b.com',
    contrasenia_usuario: '123',
  });

  assert.equal(normalizeLoginPayload({ email_usuario: 'a@b.com' }), null);
  assert.equal(normalizeLoginPayload({}), null);
});

test('serializeUsuario elimina la contraseña de la respuesta', () => {
  const result = serializeUsuario({
    id: 'u1',
    nombre_usuario: 'Ana',
    contrasenia_usuario: 'secret',
    email_usuario: 'a@b.com',
  });

  assert.deepEqual(result, {
    id: 'u1',
    nombre_usuario: 'Ana',
    email_usuario: 'a@b.com',
  });
});

test('buildUserProfileResponse agrega contadores e is_following', () => {
  const result = buildUserProfileResponse(
    {
      id: 'u1',
      nombre_usuario: 'Ana',
      seguidores: ['u2', 'u3'],
      seguidos: ['u4'],
      is_following: true,
    },
    'u3'
  );

  assert.equal(result.total_seguidores, 2);
  assert.equal(result.total_seguidos, 1);
  assert.equal(result.is_following, true);
});

test('buildUserUpdateData solo incluye imagen y contraseña válida', () => {
  const result = buildUserUpdateData({
    imagen_perfil: 'img.png',
    contrasenia_usuario: 'nueva123',
    nombre_usuario: 'Ana',
  }, 'hashed-secret');

  assert.deepEqual(result, {
    nombre_usuario: 'Ana',
    imagen_perfil: 'img.png',
    contrasenia_usuario: 'hashed-secret',
  });
});
