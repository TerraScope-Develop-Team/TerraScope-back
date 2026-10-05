import assert from "node:assert/strict";
import test from "node:test";
import { hashImage } from "../src/services/ia-cache.service.js";

test("hashImage includes content beyond the first 512 base64 characters", () => {
  const firstImage = Buffer.alloc(900, 7);
  const secondImage = Buffer.from(firstImage);
  secondImage[700] = 9;

  const firstBase64 = firstImage.toString("base64");
  const secondBase64 = secondImage.toString("base64");

  assert.equal(firstBase64.slice(0, 512), secondBase64.slice(0, 512));
  assert.notEqual(hashImage(firstBase64), hashImage(secondBase64));
});