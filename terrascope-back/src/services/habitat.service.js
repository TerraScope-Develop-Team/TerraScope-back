import prisma from '../config/db.js';

export function validateHabitatInput({ nombre_habitat, descripcion_habitat }) {
  const normalizedNombre = typeof nombre_habitat === 'string' ? nombre_habitat.trim() : '';
  const normalizedDescripcion = typeof descripcion_habitat === 'string' ? descripcion_habitat.trim() : '';

  if (!normalizedNombre || !normalizedDescripcion) {
    throw new Error('Nombre y descripción del hábitat son requeridos');
  }

  return {
    nombre_habitat: normalizedNombre,
    descripcion_habitat: normalizedDescripcion,
  };
}

export async function listHabitats({ cursor, limit = 100 }) {
  const records = await prisma.habitat.findMany({
    where: cursor ? { id: { lt: cursor } } : undefined,
    orderBy: { id: 'desc' },
    take: limit + 1,
  });

  return records;
}

export async function getHabitatByIdService({ id }) {
  return prisma.habitat.findUnique({ where: { id } });
}

export async function createHabitatService(input) {
  const normalized = validateHabitatInput(input);
  return prisma.habitat.create({ data: normalized });
}

export async function updateHabitatService({ id, nombre_habitat, descripcion_habitat }) {
  const normalized = validateHabitatInput({ nombre_habitat, descripcion_habitat });
  return prisma.habitat.update({
    where: { id },
    data: normalized,
  });
}

export async function deleteHabitatService({ id }) {
  return prisma.habitat.delete({ where: { id } });
}
