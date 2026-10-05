const EARTH_RADIUS_METERS = 6_371_000;

export const distanceInMeters = (latitudeA, longitudeA, latitudeB, longitudeB) => {
  const coordinates = [latitudeA, longitudeA, latitudeB, longitudeB];
  if (!coordinates.every(Number.isFinite)) return Infinity;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
};