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
cron.schedule("*/5 * * * *", async () => {
console.log("🔄 Generando nuevos retos dinámicos...");
await this.generarRetosAutomaticos();
});

console.log("✅ Cron job para retos configurado");

}

async generarRetosAutomaticos() {
  try {
    const MAX_RETOS_ACTIVOS = 3;
    
    // ... (Tu lógica de limpieza de retos expirados y conteo se queda igual) ...
    // Supongamos que calculamos cuántos retos faltan crear:
    const retosActivosCount = await Reto.countDocuments({ estado: "activo" });
    const espaciosDisponibles = MAX_RETOS_ACTIVOS - retosActivosCount;
    
    if (espaciosDisponibles <= 0) return;

    // ==========================================
    // 1. ANÁLISIS DE TENDENCIAS (HÍBRIDO)
    // ==========================================

    // A) Tendencias de Fauna (Por ESPECIE)
    // Buscamos animales específicos populares (ej. "Iguana")
    const topFauna = await FaunaFlora.aggregate([
      { $match: { tipo: { $nin: ["Planta", "Árbol", "Hierba", "Hongo"] } } },
      { $group: { _id: "$especie", count: { $sum: 1 } } }, // Agrupar por ESPECIE
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);

    // B) Tendencias de Flora (Por TIPO)
    // Buscamos categorías populares (ej. "Árbol")
    const topFlora = await FaunaFlora.aggregate([
      { $match: { tipo: { $in: ["Planta", "Árbol", "Hierba", "Hongo"] } } },
      { $group: { _id: "$tipo", count: { $sum: 1 } } }, // Agrupar por TIPO
      { $sort: { count: -1 } },
      { $limit: 2 }
    ]);

    // ==========================================
    // 2. CREACIÓN DE CANDIDATOS
    // ==========================================
    let candidatos = [];

    // Formateamos Fauna (Específico)
    topFauna.forEach(f => {
      candidatos.push({
        categoria: "fauna",
        key: f._id,         // ej: "Iguana"
        targetCount: Math.max(3, Math.floor(f.count * 0.4)), // Exigencia basada en popularidad
        nombre: `Avistador de ${f._id}`,
        desc: `Registra ${Math.max(3, Math.floor(f.count * 0.4))} avistamientos de ${f._id}`
      });
    });

    // Formateamos Flora (General)
    topFlora.forEach(f => {
      candidatos.push({
        categoria: "flora",
        key: f._id,         // ej: "Árbol"
        targetCount: Math.max(5, Math.floor(f.count * 0.5)), // Exigencia un poco más alta porque es más fácil
        nombre: `Explorador de ${f._id}s`, // Pluralizamos simple
        desc: `Encuentra ${Math.max(5, Math.floor(f.count * 0.5))} ejemplares de tipo ${f._id}`
      });
    });

    // Mezclar candidatos para variedad
    candidatos = shuffleArray(candidatos);

    // ==========================================
    // 3. GENERACIÓN DE RETOS
    // ==========================================

    for (let i = 0; i < espaciosDisponibles; i++) {
      if (i >= candidatos.length) break; // No hay más ideas

      const candidato = candidatos[i];
      
      // Clave de condición híbrida: 
      // Si es fauna: "fauna.Iguana"
      // Si es flora: "flora.Árbol"
      const condicionKey = `${candidato.categoria}.${candidato.key}`;

      // Verificar duplicados activos
      const existe = await Reto.findOne({ 
        estado: "activo", 
        [`condiciones.${condicionKey}`]: { $exists: true } 
      });
      
      if (existe) continue;

      const ahora = moment().tz("America/Mexico_City").toDate();
      const fechaFinal = moment(ahora).add(15, "minutes").toDate(); // Retos de 15 mins

      const nuevoReto = new Reto({
        nombre_reto: candidato.nombre,
        descripcion_reto: candidato.desc,
        fecha_inicio: ahora,
        fecha_final: fechaFinal,
        condiciones: {
          [condicionKey]: candidato.targetCount
        },
        es_temporal: true,
        estado: "activo"
      });

      await nuevoReto.save();
      await observerService.notify("NUEVO_RETO", nuevoReto);
      console.log(`✅ Nuevo reto híbrido creado: ${nuevoReto.nombre_reto}`);
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

  // services/retos.service.js

async actualizarHistorial(usuarioId, tipo, especie) {
  try {
    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) return;

    // Asegurar estructura
    if (!usuario.historial) usuario.historial = {
      fauna: {},
      flora: {}
    };

    // Listas de clasificación
    const tiposFlora = ["Planta", "Árbol", "Hierba", "Hongo"];
    // Asumimos que todo lo que no es flora, es fauna en tu sistema
    const esFlora = tiposFlora.includes(tipo);

    if (esFlora) {
      // --- ESTRATEGIA FLORA: GENERAL (Por TIPO) ---
      // Guardamos "Árbol", "Planta", etc. Ignoramos la especie específica.
      const valorActual = usuario.historial.flora.get(tipo) || 0;
      usuario.historial.flora.set(tipo, valorActual + 1);

      console.log(`✅ Progreso Flora actualizado: ${tipo} = ${valorActual + 1}`);
    } else {
      // --- ESTRATEGIA FAUNA: ESPECÍFICA (Por ESPECIE) ---
      // Guardamos "Iguana", "Águila", etc.
      const valorActual = usuario.historial.fauna.get(especie) || 0;
      usuario.historial.fauna.set(especie, valorActual + 1);

      console.log(`✅ Progreso Fauna actualizado: ${especie} = ${valorActual + 1}`);
    }

    await usuario.save();

    // Verificamos si cumplió algún reto activo
    await this.verificarProgreso(usuarioId);

  } catch (error) {
    console.error("❌ Error actualizando historial:", error);
  }
}
}

export default new RetosService();