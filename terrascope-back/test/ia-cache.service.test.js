import assert from "node:assert/strict";
import test from "node:test";
import { hashImage, hashValidationPayload } from "../src/services/ia-cache.service.js";

test("hashImage includes content beyond the first 512 base64 characters", () => {
  const firstImage = Buffer.alloc(900, 7);
  const secondImage = Buffer.from(firstImage);
  secondImage[700] = 9;

  const firstBase64 = firstImage.toString("base64");
  const secondBase64 = secondImage.toString("base64");

  assert.equal(firstBase64.slice(0, 512), secondBase64.slice(0, 512));
  assert.notEqual(hashImage(firstBase64), hashImage(secondBase64));
});

test("hashValidationPayload normaliza espacios/mayúsculas y cambia ante datos distintos", () => {
  const basePayload = {
    nombre_comun: "Jaguar",
    nombre_cientifico: "Panthera onca",
    tipo: "Fauna",
    especie: "Mamífero",
    descripcion: "Felino de gran tamaño",
    comportamiento: "Solitario y nocturno",
    estado_extincion: "Casi amenazado",
    habitat: {
      nombre_habitat: "Selva húmeda",
      descripcion_habitat: "Bosque tropical denso",
    },
  };

  const formattedPayload = {
    nombre_comun: "  jaguar  ",
    nombre_cientifico: "PANTHERA ONCA",
    tipo: " fauna ",
    especie: "mamífero",
    descripcion: "Felino de gran tamaño ",
    comportamiento: "solitario y nocturno",
    estado_extincion: "CASI AMENAZADO",
    habitat: {
      nombre_habitat: " selva húmeda",
      descripcion_habitat: "Bosque tropical denso ",
    },
  };

  const modifiedPayload = {
    ...basePayload,
    habitat: {
      nombre_habitat: "Desierto",
      descripcion_habitat: "Zona árida",
    },
  };

  const baseHash = hashValidationPayload(basePayload);
  const formattedHash = hashValidationPayload(formattedPayload);
  const modifiedHash = hashValidationPayload(modifiedPayload);

  assert.match(baseHash, /^validation:[a-f0-9]{64}$/);
  assert.equal(baseHash, formattedHash);
  assert.notEqual(baseHash, modifiedHash);
});