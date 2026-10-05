import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { optimizeImage } from "../src/utils/image-optimizer.js";

test("optimizeImage returns resized JPEG data and its MIME type", async () => {
  const inputBuffer = await sharp({
    create: {
      width: 1300,
      height: 20,
      channels: 3,
      background: "#228844",
    },
  }).png().toBuffer();

  const result = await optimizeImage(inputBuffer.toString("base64"));
  const outputMetadata = await sharp(
    Buffer.from(result.base64Output, "base64"),
  ).metadata();

  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.wasOptimized, true);
  assert.equal(outputMetadata.format, "jpeg");
  assert.ok(outputMetadata.width <= 1024);
});