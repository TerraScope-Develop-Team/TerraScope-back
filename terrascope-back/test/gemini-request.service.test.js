import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateGeminiContent,
  generateGeminiContentWithFallback,
} from '../src/services/gemini-request.service.js';

test('generateGeminiContent reintenta una vez si Gemini responde 503', async () => {
  let calls = 0;
  const model = {
    async generateContent() {
      calls += 1;
      if (calls === 1) {
        throw Object.assign(new Error('Servicio ocupado'), { status: 503 });
      }
      return { response: 'respuesta' };
    },
  };

  const result = await generateGeminiContent(model, ['prompt']);

  assert.deepEqual(result, { response: 'respuesta' });
  assert.equal(calls, 2);
});

test('generateGeminiContent no excede un reintento ante 503', async () => {
  let calls = 0;
  const unavailable = Object.assign(new Error('Servicio ocupado'), { status: 503 });
  const model = {
    async generateContent() {
      calls += 1;
      throw unavailable;
    },
  };

  await assert.rejects(generateGeminiContent(model, ['prompt']), (error) => error === unavailable);
  assert.equal(calls, 2);
});

test('generateGeminiContentWithFallback cambia de modelo tras agotar los reintentos por 503', async () => {
  let primaryCalls = 0;
  let fallbackCalls = 0;
  const primaryModel = {
    async generateContent() {
      primaryCalls += 1;
      throw Object.assign(new Error('Servicio ocupado'), { status: 503 });
    },
  };
  const fallbackModel = {
    async generateContent() {
      fallbackCalls += 1;
      return { response: 'respuesta alternativa' };
    },
  };

  const result = await generateGeminiContentWithFallback(
    primaryModel,
    fallbackModel,
    ['prompt'],
  );

  assert.deepEqual(result, { response: 'respuesta alternativa' });
  assert.equal(primaryCalls, 2);
  assert.equal(fallbackCalls, 1);
});

test('generateGeminiContentWithFallback no cambia de modelo para otros errores', async () => {
  let fallbackCalls = 0;
  const failure = Object.assign(new Error('Solicitud inválida'), { status: 400 });
  const primaryModel = {
    async generateContent() {
      throw failure;
    },
  };
  const fallbackModel = {
    async generateContent() {
      fallbackCalls += 1;
      return { response: 'no debería ejecutarse' };
    },
  };

  await assert.rejects(
    generateGeminiContentWithFallback(primaryModel, fallbackModel, ['prompt']),
    (error) => error === failure,
  );
  assert.equal(fallbackCalls, 0);
});