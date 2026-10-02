import sharp from "sharp";

/**
 * Redimensiona y comprime una imagen en base64.
 * El lado mayor no superará MAX_DIMENSION px. Calidad JPEG ajustada a JPEG_QUALITY.
 *
 * @param {string} base64Input - Imagen codificada en base64 (sin prefijo data:)
 * @returns {Promise<{ base64Output: string, originalBytes: number, optimizedBytes: number }>}
 */
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 75;

export async function optimizeImage(base64Input) {
  const inputBuffer = Buffer.from(base64Input, "base64");
  const originalBytes = inputBuffer.length;

  const outputBuffer = await sharp(inputBuffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const optimizedBytes = outputBuffer.length;
  const base64Output = outputBuffer.toString("base64");

  return { base64Output, originalBytes, optimizedBytes };
}
