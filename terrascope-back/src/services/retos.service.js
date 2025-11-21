import Reto from "../models/reto.model.js";
import Usuario from "../models/usuario.model.js";
import FaunaFlora from "../models/fauna_flora.model.js";
import observerService from "./observer.service.js";
import cron from "node-cron";

class RetosService {
  constructor() {
    this.inicializarCron();
  }

  inicializarCron() {
    cron.schedule("*/5 * * * *", async () => {
      console.log("🔄 Generando nuevos retos dinámicos cada 5 minutos...");
      await this.generarRetosAutomaticos();
    });

    console.log("✅ Cron job para retos configurado (cada 5 minutos)");
  }

  async generarRetosAutomaticos() {
    try {
      const tendencias = await FaunaFlora.aggregate([
        {
          $group: {
            _id: { tipo: "$tipo", especie: "$especie" },
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            count: { $gte: 5 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 5
        }
      ]);

      console.log("📊 Tendencias detectadas:", tendencias);

      for (const tendencia of tendencias) {
        const { tipo, especie } = tendencia._id;
        const cantidad = Math.max(5, Math.floor(tendencia.count * 0.3));

        const fechaFinal = new Date(Date.now() + 1 * 60 * 60 * 1000);

        // FORMATO CORRECTO: tipo.especie (ej: "fauna.Mamífero")
        const condicionKey = tipo === "Fauna"
          ? `fauna.${especie}`
          : `flora.${especie}`;

        const condiciones = {};
        condiciones[condicionKey] = cantidad;

        const nombreReto = `Explorador de ${especie}s`;
        const descripcionReto = `Registra ${cantidad} avistamientos de ${especie} en 1 hora`;

        const retoExistente = await Reto.findOne({
          nombre_reto: nombreReto,
          estado: "activo"
        });

        if (!retoExistente) {
          const nuevoReto = new Reto({
            nombre_reto: nombreReto,
            descripcion_reto: descripcionReto,
            fecha_inicio: new Date(),
            fecha_final: fechaFinal,
            condiciones: condiciones,
            es_temporal: true,
            estado: "activo"
          });

          await nuevoReto.save();

          await observerService.notify("NUEVO_RETO", nuevoReto);

          console.log(`✅ Reto creado automáticamente: ${nombreReto}`);
        }
      }

      await this.finalizarRetosExpirados();
    } catch (error) {
      console.error("❌ Error generando retos automáticos:", error);
    }
  }

  async finalizarRetosExpirados() {
    try {
      const ahora = new Date();
      
      const retosExpirados = await Reto.find({
        fecha_final: { $lte: ahora },
        estado: "activo"
      });

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