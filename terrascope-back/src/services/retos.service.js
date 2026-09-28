import prisma from "../config/db.js";
import observerService from "./observer.service.js";
import cron from "node-cron";
import moment from "moment-timezone";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


async function generarNombreDescripcionYCantidadIA(tipo, especie) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

   const prompt = `
Eres un generador experto de desafíos ecológicos para una aplicación móvil.

Genera un **nombre**, una **descripción corta** y un **número de avistamientos** para un reto relacionado con:

- Tipo: ${tipo}
- Categoría o especie: ${especie}

REGLAS IMPORTANTES:
1. Si "${especie}" es una CATEGORÍA general (como: Mamífero, Ave, Planta, Hongo, Reptil, Insecto, Árbol, Hierba, Arbusto, etc.):
   - NO debes describir especies específicas.
   - NO inventes animales o plantas concretas (nada de ardillas, colibríes, pinos, hongos específicos).
   - Describe el reto de forma GENERAL para esa categoría.
   - El nombre debe ser divertido y motivador, pero aplicado a la categoría completa, NO a una especie particular.

2. Si "${especie}" es una ESPECIE específica:
   - Sí puedes describir características reales de esa especie.
   - Mantén el tono divertido y fácil de leer.

3. El nombre debe ser llamativo, motivador y nada formal.
4. La descripción debe ser breve (1–2 líneas), clara y basada SOLO en la categoría o especie dada.
5. NO inventes datos científicos, NO inventes nombres.
6. El número de avistamientos debe ser un entero entre 1 y 3 (solo para pruebas).

Devuelve únicamente un JSON válido:

{
  "nombre": "texto",
  "descripcion": "texto",
  "avistamientos": numero
}
`;


    const res = await model.generateContent([prompt]);
    const raw = res.response.text().trim();

    const clean = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(clean);

  } catch (err) {
    console.error("Error IA generando nombre, descripción y cantidad:", err);

    return {
      nombre: `Reto de ${especie}`,
      descripcion: `Registra avistamientos de ${especie} para completar el desafío.`,
      avistamientos: 1
    };
  }
}


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
    // Ejecutar cada semana (Lunes a las 00:00)
    cron.schedule("0 0 * * 1", async () => {
      console.log("🔄 Generando nuevos retos dinámicos semanales...");
      await this.generarRetosAutomaticos();
    });

    console.log("✅ Cron job para retos configurado (cada semana)");
  }


  async generarRetosAutomaticos() {
    try {
      const MAX_RETOS_ACTIVOS = 3;

      // Verificar cuantos retos activos hay actualmente
      const retosActivosCount = await prisma.reto.count({ where: { estado: "activo" } });
      if (retosActivosCount >= MAX_RETOS_ACTIVOS) {
        console.log(`🔔 Hay ${retosActivosCount} retos activos, se finalizarán algunos retos para poder generar nuevos.`);

        // Buscar los retos activos más antiguos para finalizar
        const retosParaFinalizar = await prisma.reto.findMany({
          where: { estado: "activo" },
          orderBy: { fecha_inicio: 'asc' },
          take: retosActivosCount - MAX_RETOS_ACTIVOS + 1
        });

        for (const reto of retosParaFinalizar) {
          await prisma.reto.update({
            where: { id: reto.id },
            data: { estado: "finalizado" }
          });
          console.log(`⏱️ Reto forzado a finalizado para liberar espacio: ${reto.nombre_reto}`);
        }
      }


      // Primero finalizar retos expirados para evitar solapamientos
      await this.finalizarRetosExpirados();

      // --- ESPECIES POPULARES ---
      // AggregateRaw en Prisma para MongoDB
      const especiesPopularesRaw = await prisma.faunaFlora.aggregateRaw({
        pipeline: [
          { $group: { _id: { tipo: "$tipo", especie: "$especie" }, count: { $sum: 1 } } },
          { $match: { count: { $gte: 4 } } },
          { $sort: { count: -1 } }
        ]
      });
      
      const especiesPopulares = Array.isArray(especiesPopularesRaw) ? especiesPopularesRaw : [];

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
          const ia = await generarNombreDescripcionYCantidadIA(tipo, especie);
          const cantidad = ia.avistamientos; 

          // Finalizar retos activos anteriores de la misma especie
          // Para JSON en Prisma MongoDB no se puede filtrar directo en la query fácilmente, buscamos todos y filtramos
          const retosActivos = await prisma.reto.findMany({ where: { estado: "activo" } });
          const retosExistentes = retosActivos.filter(r => 
            (r.condiciones?.fauna?.[especie] !== undefined) || (r.condiciones?.flora?.[especie] !== undefined)
          );

          for (const retoExistente of retosExistentes) {
            await prisma.reto.update({
              where: { id: retoExistente.id },
              data: { estado: "finalizado" }
            });
            console.log(`⏱️ Reto anterior finalizado: ${retoExistente.nombre_reto}`);
          }

          // Hora local de México
          const ahora = moment().tz("America/Mexico_City").toDate();
          const fechaFinal = moment(ahora).add(3, "minutes").toDate(); // Cierre 3 minutos después

          const condicionKey = tipo === "Fauna" ? `fauna` : `flora`;
          const condiciones = { [condicionKey]: { [especie]: cantidad } };

          const nombreReto = ia.nombre;
          const descripcionReto = ia.descripcion;

          const nuevoReto = await prisma.reto.create({
            data: {
              nombre_reto: nombreReto,
              descripcion_reto: descripcionReto,
              fecha_inicio: ahora,
              fecha_final: fechaFinal,
              condiciones: condiciones,
              es_temporal: true,
              estado: "activo"
            }
          });

          await observerService.notify("NUEVO_RETO", nuevoReto);

          console.log(`✅ Nuevo reto creado: ${nombreReto}`);
        }
      }

      // --- ESPECIES RARAS ---
      const conteoPorTipoRaw = await prisma.faunaFlora.aggregateRaw({
        pipeline: [
          { $group: { _id: "$tipo", total: { $sum: 1 } } }
        ]
      });
      const conteoPorTipo = Array.isArray(conteoPorTipoRaw) ? conteoPorTipoRaw : [];

      let tipoMenosRegistros = "Fauna"; // default
      if (conteoPorTipo.length === 1) {
        tipoMenosRegistros = conteoPorTipo[0]._id;
      } else if (conteoPorTipo.length === 2) {
        tipoMenosRegistros = conteoPorTipo[0].total < conteoPorTipo[1].total ? conteoPorTipo[0]._id : conteoPorTipo[1]._id;
      }

      const especiesRarasRaw = await prisma.faunaFlora.aggregateRaw({
        pipeline: [
          { $match: { tipo: tipoMenosRegistros } },
          { $group: { _id: { tipo: "$tipo", especie: "$especie" }, count: { $sum: 1 } } },
          { $match: { count: { $lt: 4 } } },
          { $sort: { count: 1 } },
          { $limit: 5 }
        ]
      });
      const especiesRaras = Array.isArray(especiesRarasRaw) ? especiesRarasRaw : [];

      for (const rareza of especiesRaras) {
        const { tipo, especie } = rareza._id;

        const retosActivos = await prisma.reto.findMany({ where: { estado: "activo" } });
        const retosExistentes = retosActivos.filter(r => 
          (r.condiciones?.fauna?.[especie] !== undefined) || (r.condiciones?.flora?.[especie] !== undefined)
        );

        for (const retoExistente of retosExistentes) {
          await prisma.reto.update({
            where: { id: retoExistente.id },
            data: { estado: "finalizado" }
          });
          console.log(`⏱️ Reto anterior finalizado: ${retoExistente.nombre_reto}`);
        }

        const ahora = moment().tz("America/Mexico_City").toDate();
        const fechaFinal = moment(ahora).add(3, "minutes").toDate(); // Cierre 3 minutos después

        const condicionKey = tipo === "Fauna" ? `fauna` : `flora`;
        const ia = await generarNombreDescripcionYCantidadIA(tipo, especie);
        const cantidad = ia.avistamientos;
        const condiciones = { [condicionKey]: { [especie]: cantidad } };

        const nombreReto = ia.nombre;
        const descripcionReto = ia.descripcion;

        const nuevoReto = await prisma.reto.create({
          data: {
            nombre_reto: nombreReto,
            descripcion_reto: descripcionReto,
            fecha_inicio: ahora,
            fecha_final: fechaFinal,
            condiciones: condiciones,
            es_temporal: true,
            estado: "activo"
          }
        });

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

      const retosExpirados = await prisma.reto.findMany({
        where: {
          fecha_final: { lte: ahora },
          estado: "activo"
        }
      });

      if (retosExpirados.length === 0) {
        console.log("No hay retos expirados para finalizar.");
      }

      for (const reto of retosExpirados) {
        await prisma.reto.update({
          where: { id: reto.id },
          data: { estado: "finalizado" }
        });
        console.log(`⏱️ Reto finalizado: ${reto.nombre_reto}`);
      }
    } catch (error) {
      console.error("❌ Error finalizando retos:", error);
    }
  }

  async verificarProgreso(usuarioId) {
    try {
      console.log(`🔍 Verificando progreso para usuario: ${usuarioId}`);
      
      const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
      if (!usuario) {
        console.log("❌ Usuario no encontrado");
        return;
      }

      const retosActivos = await prisma.reto.findMany({
        where: {
          id: { in: usuario.retos_activos },
          estado: "activo"
        }
      });

      console.log(`📋 Retos activos del usuario: ${retosActivos.length}`);

      for (const reto of retosActivos) {
        console.log(`\n🎯 Verificando reto: ${reto.nombre_reto}`);
        console.log(`Condiciones:`, reto.condiciones);
        
        const cumpleCondiciones = await this.verificarCondiciones(usuario, reto);
        
        if (cumpleCondiciones) {
          console.log(`✅ ¡Usuario cumple todas las condiciones!`);
          await this.completarReto(usuarioId, reto.id);
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
        fauna: usuario.historial?.fauna || {},
        flora: usuario.historial?.flora || {}
      });

      if (!reto.condiciones) return false;

      // Iterar sobre condiciones. Las condiciones ahora están guardadas como JSON anidado
      // { fauna: { Mamífero: 2 } } o si estaba plano { "fauna.Mamífero": 2 }
      
      const flattenObj = (ob) => {
        let result = {};
        for (const i in ob) {
            if ((typeof ob[i]) === 'object' && !Array.isArray(ob[i])) {
                const temp = flattenObj(ob[i]);
                for (const j in temp) {
                    result[i + '.' + j] = temp[j];
                }
            }
            else {
                result[i] = ob[i];
            }
        }
        return result;
      };

      const condiciones = flattenObj(reto.condiciones);

      for (const [key, valorRequerido] of Object.entries(condiciones)) {
        console.log(`\n🔍 Verificando condición: ${key} >= ${valorRequerido}`);
        
        const [categoria, subcategoria] = key.split(".");
        
        const valorUsuario = usuario.historial?.[categoria]?.[subcategoria] || 0;
        
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
      
      const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
      const reto = await prisma.reto.findUnique({ where: { id: retoId } });

      if (!usuario || !reto) {
        console.log("❌ Usuario o reto no encontrado");
        return;
      }

      const yaCompletado = reto.usuarios_finalizados.some(
        u => u.usuario_id === usuarioId
      );

      if (yaCompletado) {
        console.log("⚠️ Usuario ya había completado este reto");
        return;
      }

      const posicion = reto.usuarios_finalizados.length + 1;
      
      const usuariosFinalizadosUpdated = [...reto.usuarios_finalizados, {
        usuario_id: usuarioId,
        fecha_completado: new Date(),
        posicion: posicion
      }];

      await prisma.reto.update({
        where: { id: retoId },
        data: {
          usuarios_finalizados: usuariosFinalizadosUpdated
        }
      });
      console.log(`✅ Reto guardado con usuario en posición ${posicion}`);

      const descripcionLogro = this.generarDescripcionLogro(posicion, reto.nombre_reto);
      
      const logrosUpdated = [...usuario.logros, {
        id_reto_base: retoId,
        nombre_logro: reto.nombre_reto,
        descripcion_titulo: descripcionLogro,
        fecha_obtencion: new Date(),
        es_mostrado: true
      }];

      const retosActivosUpdated = usuario.retos_activos.filter(id => id !== retoId);

      await prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          logros: logrosUpdated,
          retos_activos: retosActivosUpdated
        }
      });
      console.log(`✅ Logro agregado al usuario`);

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
      
      const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
      if (!usuario) {
        console.log("❌ Usuario no encontrado");
        return;
      }

      let historial = usuario.historial || { fauna: {}, flora: {} };
      if (!historial.fauna) historial.fauna = {};
      if (!historial.flora) historial.flora = {};

      const tipoMin = tipo.toLowerCase(); // 'fauna' o 'flora'

      if (tipo === "Fauna") {
        historial.fauna[especie] = (historial.fauna[especie] || 0) + 1;
        console.log(`✅ Fauna.${especie}: ${historial.fauna[especie]}`);
      } else if (tipo === "Flora") {
        historial.flora[especie] = (historial.flora[especie] || 0) + 1;
        console.log(`✅ Flora.${especie}: ${historial.flora[especie]}`);
      }

      await prisma.usuario.update({
        where: { id: usuarioId },
        data: { historial }
      });
      console.log(`✅ Historial guardado`);
      
      await this.verificarProgreso(usuarioId);
    } catch (error) {
      console.error("❌ Error actualizando historial:", error);
    }
  }
}

export default new RetosService();