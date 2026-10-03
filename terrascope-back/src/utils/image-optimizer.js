import sharp from "sharp";

/**
 * Redimensiona y comprime una imagen en base64.
 * El lado mayor no superará MAX_DIMENSION px. Calidad JPEG ajustada a JPEG_QUALITY.
 *
 * @param {string} base64Input - Imagen codificada en base64 (sin prefijo data:)
 * @returns {Promise<{ base64Output: string, originalBytes: number, optimizedBytes: number, mimeType: string, wasOptimized: boolean }>}
 */
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 75;
const MIME_TYPES = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heif: "image/heif",
  avif: "image/avif",
};

export async function optimizeImage(base64Input) {
  const inputBuffer = Buffer.from(base64Input, "base64");
  const originalBytes = inputBuffer.length;
  const metadata = await sharp(inputBuffer).metadata();
  const originalMimeType = MIME_TYPES[metadata.format];

  try {
    const outputBuffer = await sharp(inputBuffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    return {
      base64Output: outputBuffer.toString("base64"),
      originalBytes,
      optimizedBytes: outputBuffer.length,
      mimeType: "image/jpeg",
      wasOptimized: true,
    };
  } catch (error) {
    if (!originalMimeType) {
      throw error;
    }

    return {
      base64Output: base64Input,
      originalBytes,
      optimizedBytes: originalBytes,
      mimeType: originalMimeType,
      wasOptimized: false,
    };
  }
}
