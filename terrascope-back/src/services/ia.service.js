export function parseJsonResponse(text = '') {
  const cleaned = String(text)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  if (!cleaned) {
    throw new Error('La respuesta de IA está vacía');
  }

  return JSON.parse(cleaned);
}

export function validateIdentificationInput(body = {}) {
  const { imagen } = body;

  if (!imagen || typeof imagen !== 'string' || !imagen.trim()) {
    throw new Error('No se recibió ninguna imagen en base64');
  }

  return { imagen: imagen.trim() };
}

export function buildIdentificationPrompt() {
  return `
Eres un experto en biología y taxonomía. Analiza la imagen y determina la especie del ser vivo que aparece.
Devuelve únicamente un JSON válido con este formato:
{
  "nombre_cientifico": "Nombre científico",
  "nombre_comun": "Nombre común en español",
  "nivel_confianza": "Alto | Medio | Bajo"
}
Si no puedes identificar la especie, usa "Desconocido" y nivel "Bajo".
`;
}

export function validateContextualValidationInput(data = {}) {
  const {
    nombre_comun,
    nombre_cientifico,
    especie,
    descripcion,
    habitat,
  } = data;

  if (!nombre_comun || !nombre_cientifico || !especie || !descripcion || !habitat?.nombre_habitat) {
    throw new Error('Faltan campos obligatorios para la validación contextual');
  }

  return {
    ...data,
    nombre_comun: String(nombre_comun).trim(),
    nombre_cientifico: String(nombre_cientifico).trim(),
    especie: String(especie).trim(),
    descripcion: String(descripcion).trim(),
    habitat: {
      ...habitat,
      nombre_habitat: String(habitat.nombre_habitat).trim(),
    },
  };
}

export function buildValidationPrompt(data = {}) {
  const {
    nombre_comun,
    nombre_cientifico,
    tipo,
    especie,
    descripcion,
    comportamiento,
    estado_extincion,
    habitat,
  } = data;

  return `
Eres un experto en biología y validación de datos ecológicos.
Analiza si estos datos son coherentes y realistas:
- Nombre común: ${nombre_comun}
- Nombre científico: ${nombre_cientifico}
- Tipo: ${tipo}
- Especie: ${especie}
- Descripción: ${descripcion}
- Comportamiento: ${comportamiento}
- Estado de extinción: ${estado_extincion}
- Hábitat: ${habitat?.nombre_habitat}
- Descripción del hábitat: ${habitat?.descripcion_habitat || 'No especificada'}

Devuelve únicamente un JSON válido:
{
  "es_coherente": true,
  "errores_detectados": [],
  "sugerencia": "Texto breve"
}
`;
}

export function fallbackIdentificationResponse() {
  return {
    nombre_comun: 'Desconocido',
    nombre_cientifico: 'Desconocido',
    nivel_confianza: 'Bajo',
  };
}

export function fallbackValidationResponse() {
  return {
    es_coherente: false,
    errores_detectados: ['No fue posible interpretar la respuesta del modelo'],
    sugerencia: 'Verifica los datos e inténtalo nuevamente',
  };
}
