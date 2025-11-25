import Reto from "../models/reto.model.js";
import Usuario from "../models/usuario.model.js";
import FaunaFlora from "../models/fauna_flora.model.js";
import observerService from "./observer.service.js";
import cron from "node-cron";
import moment from "moment-timezone";

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

class RetosService {
constructor() {
this.inicializarCron();
}

inicializarCron() {
// Ejecutar cada minuto para pruebas; luego cambiar a cada 6 horas
cron.schedule("*/10 * * * *", async () => {
console.log("🔄 Generando nuevos retos dinámicos...");
await this.generarRetosAutomaticos();
});

console.log("✅ Cron job para retos configurado");

}

async generarRetosAutomaticos() {
try {
  const MAX_RETOS_ACTIVOS = 3;

  // Verificar cuantos retos activos hay actualmente
    const retosActivosCount = await Reto.countDocuments({ estado: "activo" });
    if (retosActivosCount >= MAX_RETOS_ACTIVOS) {
      console.log(`🔔 Hay ${retosActivosCount} retos activos, se finalizarán algunos retos para poder generar nuevos.`);

      // Buscar los retos activos más antiguos para finalizar (solo los necesarios para bajar el conteo)
      const retosParaFinalizar = await Reto.find({ estado: "activo" })
        .sort({ fecha_inicio: 1 }) // ordenar por fecha de inicio ascendente (los más viejos primero)
        .limit(retosActivosCount - MAX_RETOS_ACTIVOS + 1);

      for (const reto of retosParaFinalizar) {
        reto.estado = "finalizado";
        await reto.save();
        console.log(`⏱️ Reto forzado a finalizado para liberar espacio: ${reto.nombre_reto}`);
      }
    }


// Primero finalizar retos expirados para evitar solapamientos
await this.finalizarRetosExpirados();

// --- ESPECIES POPULARES ---
const especiesPopulares = await FaunaFlora.aggregate([
  { $group: { _id: { tipo: "$tipo", especie: "$especie" }, count: { $sum: 1 } } },
  { $match: { count: { $gte: 4 } } },
  { $sort: { count: -1 } }
]);

if (especiesPopulares.length === 0) {
  console.log("No hay especies populares suficientes para generar retos.");
} else {
  // Mantener las 2 especies más populares fijas
  const topDos = especiesPopulares.slice(0, 2);

  // Las demás especies populares para posible variación
  const resto = especiesPopulares.slice(2);

  // Mezclar resto y seleccionar suficientes para completar un total de 5 retos populares
  const cantidadResto = Math.max(0, 5 - topDos.length);
  const restoAleatorio = shuffleArray(resto).slice(0, cantidadResto);

  const especiesParaRetos = topDos.concat(restoAleatorio);

  for (const tendencia of especiesParaRetos) {
    const { tipo, especie } = tendencia._id;
    const cantidad = Math.max(5, Math.floor(tendencia.count * 0.3));

    // Finalizar retos activos anteriores de la misma especie
    const retosExistentes = await Reto.find({
      estado: "activo",
      $or: [
        { [`condiciones.fauna.${especie}`]: { $exists: true } },
        { [`condiciones.flora.${especie}`]: { $exists: true } }
      ]
    });

    for (const retoExistente of retosExistentes) {
      retoExistente.estado = "finalizado";
      await retoExistente.save();
      console.log(`⏱️ Reto anterior finalizado: ${retoExistente.nombre_reto}`);
    }

    // Hora local de México
    const ahora = moment().tz("America/Mexico_City").toDate();
    const fechaFinal = moment(ahora).add(3, "minutes").toDate(); // Cierre 3 minutos después

    const condicionKey = tipo === "Fauna" ? `fauna.${especie}` : `flora.${especie}`;
    const condiciones = { [condicionKey]: cantidad };

    const nombreReto = `Explorador de ${especie}`;
    const descripcionReto = `Registra ${cantidad} avistamientos de ${especie} en 3 minutos`;

    const nuevoReto = new Reto({
      nombre_reto: nombreReto,
      descripcion_reto: descripcionReto,
      fecha_inicio: ahora,
      fecha_final: fechaFinal,
      condiciones: condiciones,
      es_temporal: true,
      estado: "activo"
    });

    await nuevoReto.save();
    await observerService.notify("NUEVO_RETO", nuevoReto);

    console.log(`✅ Nuevo reto creado: ${nombreReto}`);
  }
}

// --- ESPECIES RARAS ---

// Contar registros totales por tipo para decidir qué tipo tiene menos registros
const conteoPorTipo = await FaunaFlora.aggregate([
  { $group: { _id: "$tipo", total: { $sum: 1 } } }
]);
// Determinar tipo con menos registros
let tipoMenosRegistros = "Fauna"; // default
if (conteoPorTipo.length === 1) {
  tipoMenosRegistros = conteoPorTipo[0]._id;
} else if (conteoPorTipo.length === 2) {
  tipoMenosRegistros = conteoPorTipo[0].total < conteoPorTipo[1].total ? conteoPorTipo[0]._id : conteoPorTipo[1]._id;
}

// Obtener especies raras solo del tipo con menos registros
const especiesRaras = await FaunaFlora.aggregate([
  { $match: { tipo: tipoMenosRegistros } },
  { $group: { _id: { tipo: "$tipo", especie: "$especie" }, count: { $sum: 1 } } },
  { $match: { count: { $lt: 4 } } },
  { $sort: { count: 1 } },
  { $limit: 5 }
]);

for (const rareza of especiesRaras) {
  const { tipo, especie } = rareza._id;

  const retosExistentes = await Reto.find({
    estado: "activo",
    $or: [
      { [`condiciones.fauna.${especie}`]: { $exists: true } },
      { [`condiciones.flora.${especie}`]: { $exists: true } }
    ]
  });

  for (const retoExistente of retosExistentes) {
    retoExistente.estado = "finalizado";
    await retoExistente.save();
    console.log(`⏱️ Reto anterior finalizado: ${retoExistente.nombre_reto}`);
  }

  const ahora = moment().tz("America/Mexico_City").toDate();
  const fechaFinal = moment(ahora).add(3, "minutes").toDate(); // Cierre 3 minutos después

  const condicionKey = tipo === "Fauna" ? `fauna.${especie}` : `flora.${especie}`;
  const condiciones = { [condicionKey]: 1 };

  const nombreReto = `Explorador raro: ${especie}`;
  const descripcionReto = `Registra al menos 1 avistamiento de ${especie} en 3 minutos`;

  const nuevoReto = new Reto({
    nombre_reto: nombreReto,
    descripcion_reto: descripcionReto,
    fecha_inicio: ahora,
    fecha_final: fechaFinal,
    condiciones: condiciones,
    es_temporal: true,
    estado: "activo"
  });

  await nuevoReto.save();
  await observerService.notify("NUEVO_RETO", nuevoReto);

  console.log(`✅ Nuevo reto raro creado: ${nombreReto}`);
}
} catch (error) {
console.error("❌ Error generando retos automáticos:", error);
}
}
async finalizarRetosExpirados() {
try {
const ahora = moment().tz("America/Mexico_City").toDate();

  const retosExpirados = await Reto.find({
    fecha_final: { $lte: ahora },
    estado: "activo"
  });

  if (retosExpirados.length === 0) {
    console.log("No hay retos expirados para finalizar.");
  }

  for (const reto of retosExpirados) {
    reto.estado = "finalizado";
    await reto.save();
    console.log(`⏱️ Reto finalizado: ${reto.nombre_reto}`);
  }
} catch (error) {
  console.error("❌ Error finalizando retos:", error);
}

}
  async verificarProgreso(usuarioId) {
    try {
      console.log(`🔍 Verificando progreso para usuario: ${usuarioId}`);
      
      const usuario = await Usuario.findById(usuarioId);
      if (!usuario) {
        console.log("❌ Usuario no encontrado");
        return;
      }

      const retosActivos = await Reto.find({
        _id: { $in: usuario.retos_activos },
        estado: "activo"
      });

      console.log(`📋 Retos activos del usuario: ${retosActivos.length}`);

      for (const reto of retosActivos) {
        console.log(`\n🎯 Verificando reto: ${reto.nombre_reto}`);
        console.log(`Condiciones:`, reto.condiciones);
        
        const cumpleCondiciones = await this.verificarCondiciones(usuario, reto);
        
        if (cumpleCondiciones) {
          console.log(`✅ ¡Usuario cumple todas las condiciones!`);
          await this.completarReto(usuarioId, reto._id);
        } else {
          console.log(`❌ Aún no cumple todas las condiciones`);
        }
      }
    } catch (error) {
      console.error("❌ Error verificando progreso:", error);
    }
  }

  async verificarCondiciones(usuario, reto) {
    try {
      console.log(`\n📊 Historial del usuario:`, {
        fauna: usuario.historial.fauna || {},
        flora: usuario.historial.flora || {}
      });

      for (const [key, valorRequerido] of Object.entries(reto.condiciones)) {
        console.log(`\n🔍 Verificando condición: ${key} >= ${valorRequerido}`);
        
        // Dividir la clave: "fauna.Mamífero" -> ["fauna", "Mamífero"]
        const [categoria, subcategoria] = key.split(".");
        
        // Obtener valor actual del historial
        const valorUsuario = usuario.historial[categoria]?.[subcategoria] || 0;
        
        console.log(`  📈 Valor usuario: ${valorUsuario}`);
        console.log(`  🎯 Valor requerido: ${valorRequerido}`);
        
        if (valorUsuario < valorRequerido) {
          console.log(`  ❌ NO cumple (${valorUsuario} < ${valorRequerido})`);
          return false;
        }
        
        console.log(`  ✅ Cumple (${valorUsuario} >= ${valorRequerido})`);
      }
      
      return true;
    } catch (error) {
      console.error("❌ Error verificando condiciones:", error);
      return false;
    }
  }

  async completarReto(usuarioId, retoId) {
    try {
      console.log(`\n🏆 COMPLETANDO RETO...`);
      
      const usuario = await Usuario.findById(usuarioId);
      const reto = await Reto.findById(retoId);

      if (!usuario || !reto) {
        console.log("❌ Usuario o reto no encontrado");
        return;
      }

      // Verificar si ya completó
      const yaCompletado = reto.usuarios_finalizados.some(
        u => u.usuario_id.toString() === usuarioId.toString()
      );

      if (yaCompletado) {
        console.log("⚠️ Usuario ya había completado este reto");
        return;
      }

      // Calcular posición
      const posicion = reto.usuarios_finalizados.length + 1;
      
      // Agregar a usuarios finalizados
      reto.usuarios_finalizados.push({
        usuario_id: usuarioId,
        fecha_completado: new Date(),
        posicion: posicion
      });

      await reto.save();
      console.log(`✅ Reto guardado con usuario en posición ${posicion}`);

      // Crear logro
      const descripcionLogro = this.generarDescripcionLogro(posicion, reto.nombre_reto);
      
      usuario.logros.push({
        id_reto_base: retoId,
        nombre_logro: reto.nombre_reto,
        descripcion_titulo: descripcionLogro,
        fecha_obtencion: new Date(),
        es_mostrado: true
      });

      // Remover de retos activos
      usuario.retos_activos = usuario.retos_activos.filter(
        id => id.toString() !== retoId.toString()
      );

      await usuario.save();
      console.log(`✅ Logro agregado al usuario`);

      // Notificar
      await observerService.notify("RETO_COMPLETADO", { usuario, reto });

      console.log(`🎉 ${usuario.nombre_usuario} completó: ${reto.nombre_reto} - Posición: ${posicion}`);
    } catch (error) {
      console.error("❌ Error completando reto:", error);
    }
  }

  generarDescripcionLogro(posicion, nombreReto) {
    if (posicion === 1) {
      return `🥇 ¡Primer lugar en "${nombreReto}"!`;
    } else if (posicion === 2) {
      return `🥈 ¡Segundo lugar en "${nombreReto}"!`;
    } else if (posicion === 3) {
      return `🥉 ¡Tercer lugar en "${nombreReto}"!`;
    } else {
      return `✅ Completado: "${nombreReto}"`;
    }
  }

  async actualizarHistorial(usuarioId, tipo, especie) {
    try {
      console.log(`\n📝 Actualizando historial: ${tipo} - ${especie}`);
      
      const usuario = await Usuario.findById(usuarioId);
      if (!usuario) {
        console.log("❌ Usuario no encontrado");
        return;
      }

      // Asegurarse de que existen las estructuras
      if (!usuario.historial) {
        usuario.historial = { fauna: {}, flora: {} };
      }
      if (!usuario.historial.fauna) {
        usuario.historial.fauna = {};
      }
      if (!usuario.historial.flora) {
        usuario.historial.flora = {};
      }

      // Actualizar el contador
      if (tipo === "Fauna") {
        usuario.historial.fauna[especie] = (usuario.historial.fauna[especie] || 0) + 1;
        console.log(`✅ Fauna.${especie}: ${usuario.historial.fauna[especie]}`);
      } else if (tipo === "Flora") {
        usuario.historial.flora[especie] = (usuario.historial.flora[especie] || 0) + 1;
        console.log(`✅ Flora.${especie}: ${usuario.historial.flora[especie]}`);
      }

      await usuario.save();
      console.log(`✅ Historial guardado`);
      
      // VERIFICAR PROGRESO INMEDIATAMENTE
      await this.verificarProgreso(usuarioId);
    } catch (error) {
      console.error("❌ Error actualizando historial:", error);
    }
  }
}

export default new RetosService();