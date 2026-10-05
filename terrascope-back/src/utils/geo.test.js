import test from "node:test";
import assert from "node:assert/strict";
import { distanceInMeters } from "./geo.js";

test("distanceInMeters returns zero for the same point", () => {
  assert.equal(distanceInMeters(19.4326, -99.1332, 19.4326, -99.1332), 0);
});

test("distanceInMeters distinguishes points within and outside two kilometers", () => {
  const longitudeForTwoKilometersAtEquator = 2_000 / 111_195;

  assert.ok(
    distanceInMeters(0, 0, 0, longitudeForTwoKilometersAtEquator * 0.75) < 2_000
  );
  assert.ok(
    distanceInMeters(0, 0, 0, longitudeForTwoKilometersAtEquator * 1.25) > 2_000
  );
});

test("distanceInMeters rejects non-numeric coordinates", () => {
  assert.equal(distanceInMeters(0, 0, Number.NaN, 0), Infinity);
});