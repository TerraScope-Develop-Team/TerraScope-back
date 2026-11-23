import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_MODEL,
  GeminiRateLimitError,
  generateGeminiContent,
  generateGeminiContentWithFallback,
  isGeminiRateLimitError,
  resolveGeminiModelNames,
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

test('resolveGeminiModelNames usa flash-lite por defecto y respeta variables de entorno', () => {
  assert.deepEqual(resolveGeminiModelNames({}), {
    primary: DEFAULT_GEMINI_MODEL,
    fallback: DEFAULT_GEMINI_FALLBACK_MODEL,
  });

  assert.deepEqual(
    resolveGeminiModelNames({
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
    }),
    {
      primary: 'gemini-2.5-flash',
      fallback: 'gemini-3.5-flash-lite',
    },
  );

  assert.deepEqual(
    resolveGeminiModelNames({
      GEMINI_MODEL: 'gemini-2.5-flash-lite',
    }),
    {
      primary: 'gemini-2.5-flash-lite',
      fallback: null,
    },
  );

  assert.deepEqual(
    resolveGeminiModelNames({
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_FALLBACK_MODEL: '',
    }),
    {
      primary: 'gemini-2.5-flash',
      fallback: null,
    },
  );
});

test('isGeminiRateLimitError detecta 429 y RESOURCE_EXHAUSTED e ignora 400/500', () => {
  assert.equal(isGeminiRateLimitError({ status: 429 }), true);
  assert.equal(isGeminiRateLimitError({ statusCode: 429 }), true);
  assert.equal(
    isGeminiRateLimitError(new Error('429 Too Many Requests: RESOURCE_EXHAUSTED')),
    true,
  );
  assert.equal(isGeminiRateLimitError(new GeminiRateLimitError()), true);

  assert.equal(isGeminiRateLimitError({ status: 400, message: 'Bad Request' }), false);
  assert.equal(isGeminiRateLimitError({ status: 500, message: 'Internal Server Error' }), false);
  assert.equal(isGeminiRateLimitError(null), false);
});

test('generateGeminiContent no reintenta ante 429 para no agotar más cuota', async () => {
  let calls = 0;
  const rateLimitError = Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 });
  const model = {
    async generateContent() {
      calls += 1;
      throw rateLimitError;
    },
  };

  await assert.rejects(
    generateGeminiContent(model, ['prompt']),
    (error) => error === rateLimitError,
  );
  assert.equal(calls, 1);
});

test('generateGeminiContentWithFallback cambia al modelo de respaldo ante 429', async () => {
  let primaryCalls = 0;
  let fallbackCalls = 0;
  const primaryModel = {
    async generateContent() {
      primaryCalls += 1;
      throw Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 });
    },
  };
  const fallbackModel = {
    async generateContent() {
      fallbackCalls += 1;
      return { response: 'respuesta respaldo' };
    },
  };

  const result = await generateGeminiContentWithFallback(
    primaryModel,
    fallbackModel,
    ['prompt'],
  );

  assert.deepEqual(result, { response: 'respuesta respaldo' });
  assert.equal(primaryCalls, 1);
  assert.equal(fallbackCalls, 1);
});

test('generateGeminiContentWithFallback lanza GeminiRateLimitError si ambos fallan con 429 o no hay respaldo', async () => {
  const rateLimitPrimary = Object.assign(new Error('Quota exceeded'), { status: 429 });
  const rateLimitFallback = Object.assign(new Error('Fallback quota exceeded'), { status: 429 });

  const primaryModel = {
    async generateContent() {
      throw rateLimitPrimary;
    },
  };
  const fallbackModel = {
    async generateContent() {
      throw rateLimitFallback;
    },
  };

  await assert.rejects(
    generateGeminiContentWithFallback(primaryModel, fallbackModel, ['prompt']),
    (error) =>
      error instanceof GeminiRateLimitError
      && error.statusCode === 429
      && error.code === 'GEMINI_RATE_LIMIT',
  );

  await assert.rejects(
    generateGeminiContentWithFallback(primaryModel, null, ['prompt']),
    (error) =>
      error instanceof GeminiRateLimitError
      && error.statusCode === 429
      && error.code === 'GEMINI_RATE_LIMIT',
  );
});