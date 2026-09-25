import prisma from "./src/config/db.js";

const habitatsData = [
  {
    nombre_habitat: "Bosque",
    descripcion_habitat: "Ecosistema con alta densidad de árboles y vegetación."
  },
  {
    nombre_habitat: "Selva",
    descripcion_habitat: "Bioma con vegetación exuberante y clima tropical."
  },
  {
    nombre_habitat: "Desierto",
    descripcion_habitat: "Región árida con precipitaciones muy escasas."
  },
  {
    nombre_habitat: "Océano",
    descripcion_habitat: "Gran masa de agua salada que cubre la mayor parte de la Tierra."
  },
  {
    nombre_habitat: "Urbano",
    descripcion_habitat: "Área dominada por construcciones humanas y ciudades."
  },
  {
    nombre_habitat: "Montaña",
    descripcion_habitat: "Elevación natural del terreno de gran altitud."
  },
  {
    nombre_habitat: "Sabana",
    descripcion_habitat: "Llanura con escasa vegetación arbórea, clima cálido."
  }
];

async function seedHabitats() {
  console.log("🌱 Iniciando la creación de hábitats...");
  try {
    const count = await prisma.habitat.count();
    if (count > 0) {
      console.log(`⚠️ Ya existen ${count} hábitats. Saltando semilla.`);
    } else {
      await prisma.habitat.createMany({
        data: habitatsData
      });
      console.log("✅ 7 Hábitats creados exitosamente.");
    }
  } catch (error) {
    console.error("❌ Error al crear hábitats:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedHabitats();
