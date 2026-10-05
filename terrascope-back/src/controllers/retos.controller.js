import prisma from "../config/db.js";
import retosService from "../services/retos.service.js";

const isValidObjectId = (id) =>
  typeof id === "string" && /^[a-f\d]{24}$/i.test(id);

export const obtenerRetosActivos = async (req, res) => {
  try {
    const retos = await prisma.reto.findMany({
      where: { estado: "activo" },
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json(retos);
  } catch (error) {
    console.error("❌ Error obteniendo retos:", error);
    res.status(500).json({
      message: "Error al obtener retos activos",
      error: error.message
    });
  }
};

export const obtenerRetoById = async (req, res) => {
  try {
    const reto = await prisma.reto.findUnique({
      where: { id: req.params.id }
    });
    
    if (!reto) {
      return res.status(404).json({ message: "Reto no encontrado" });
    }
    
    res.status(200).json(reto);
  } catch (error) {
    console.error("❌ Error obteniendo reto:", error);
    res.status(500).json({
      message: "Error al obtener reto",
      error: error.message
    });
  }
};

export const inscribirseReto = async (req, res) => {
  try {
    const { retoId } = req.body || {};
    const usuarioId = req.usuario?.id?.toString();

    if (!isValidObjectId(retoId)) {
      return res.status(400).json({ message: "Se requiere un ID de reto válido" });
    }
    if (!usuarioId || !isValidObjectId(usuarioId)) {
      return res.status(401).json({ message: "No se pudo identificar al usuario autenticado" });
    }

    const reto = await prisma.reto.findUnique({ where: { id: retoId } });
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });

    if (!reto || !usuario) {
      return res.status(404).json({ message: "Reto o usuario no encontrado" });
    }

    if (reto.estado !== "activo") {
      return res.status(400).json({ message: "Este reto no está activo" });
    }

    const yaInscrito = reto.usuarios_inscritos.includes(usuarioId);
    let retoActualizado = reto;
    if (!yaInscrito) {
      retoActualizado = await prisma.reto.update({
        where: { id: retoId },
        data: {
          usuarios_inscritos: {
            push: usuarioId
          }
        }
      });
    }

    if (!usuario.retos_activos.includes(retoId)) {
      await prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          retos_activos: {
            push: retoId
          }
        }
      });
    }

    const [retoPersistido, usuarioPersistido] = await Promise.all([
      prisma.reto.findUnique({
        where: { id: retoId },
        select: { id: true, usuarios_inscritos: true }
      }),
      prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, retos_activos: true }
      })
    ]);

    if (
      !retoPersistido?.usuarios_inscritos.includes(usuarioId) ||
      !usuarioPersistido?.retos_activos.includes(retoId)
    ) {
      throw new Error("La inscripción no quedó persistida en el reto y el usuario");
    }

    res.status(200).json({
      message: yaInscrito ? "Ya estabas inscrito en el reto" : "Inscripción exitosa",
      reto: {
        ...retoActualizado,
        usuarios_inscritos: retoPersistido.usuarios_inscritos
      },
      usuarioId
    });
  } catch (error) {
    console.error("❌ Error inscribiendo en reto:", error);
    res.status(500).json({
      message: "Error al inscribirse en el reto",
      error: error.message
    });
  }
};

export const desinscribirseReto = async (req, res) => {
  try {
    const { retoId, usuarioId } = req.body || {};

    if (!isValidObjectId(retoId)) {
      return res.status(400).json({ message: "Se requiere un ID de reto válido" });
    }
    if (!isValidObjectId(usuarioId)) {
      return res.status(400).json({ message: "Se requiere un ID de usuario válido" });
    }

    const reto = await prisma.reto.findUnique({ where: { id: retoId } });
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });

    if (!reto || !usuario) {
      return res.status(404).json({ message: "Reto o usuario no encontrado" });
    }

    await prisma.reto.update({
      where: { id: retoId },
      data: {
        usuarios_inscritos: reto.usuarios_inscritos.filter(id => id !== usuarioId)
      }
    });

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        retos_activos: usuario.retos_activos.filter(id => id !== retoId)
      }
    });

    res.status(200).json({
      message: "Desinscripción exitosa"
    });
  } catch (error) {
    console.error("❌ Error desinscribiendo del reto:", error);
    res.status(500).json({
      message: "Error al desinscribirse del reto",
      error: error.message
    });
  }
};

export const obtenerTablaPosiciones = async (req, res) => {
  try {
    const { retoId } = req.params;
    
    // Obtener reto y manual populate de usuarios (Prisma on MongoDB doesn't support relation inside composite types easily for populate)
    const reto = await prisma.reto.findUnique({
      where: { id: retoId }
    });

    if (!reto) {
      return res.status(404).json({ message: "Reto no encontrado" });
    }

    let top3 = reto.usuarios_finalizados
      .sort((a, b) => a.posicion - b.posicion)
      .slice(0, 3);
      
    // Manual "populate"
    const userIds = top3.map(t => t.usuario_id).filter(id => id);
    const users = await prisma.usuario.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nombre_usuario: true, imagen_perfil: true }
    });
    
    top3 = top3.map(u => {
      const userData = users.find(user => user.id === u.usuario_id);
      return {
        usuario: userData || u.usuario_id,
        posicion: u.posicion,
        fecha_completado: u.fecha_completado
      };
    });

    res.status(200).json({
      nombre_reto: reto.nombre_reto,
      top3: top3
    });
  } catch (error) {
    console.error("❌ Error obteniendo tabla de posiciones:", error);
    res.status(500).json({
      message: "Error al obtener tabla de posiciones",
      error: error.message
    });
  }
};

export const obtenerLogrosUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId }
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Manual populate of logros
    const retosIds = usuario.logros.map(l => l.id_reto_base).filter(id => id);
    const retos = await prisma.reto.findMany({
      where: { id: { in: retosIds } },
      select: { id: true, nombre_reto: true, descripcion_reto: true }
    });
    
    const logrosConPopulate = usuario.logros.map(l => {
      const reto = retos.find(r => r.id === l.id_reto_base);
      return {
        ...l,
        id_reto_base: reto || l.id_reto_base
      };
    });

    res.status(200).json({
      logros: logrosConPopulate,
      historial: usuario.historial
    });
  } catch (error) {
    console.error("❌ Error obteniendo logros:", error);
    res.status(500).json({
      message: "Error al obtener logros del usuario",
      error: error.message
    });
  }
};

export const toggleMostrarLogro = async (req, res) => {
  try {
    const { usuarioId, logroId } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const logroIndex = usuario.logros.findIndex(l => l.id_reto_base === logroId || l.nombre_logro === logroId);
    if (logroIndex === -1) {
      return res.status(404).json({ message: "Logro no encontrado" });
    }

    usuario.logros[logroIndex].es_mostrado = !usuario.logros[logroIndex].es_mostrado;
    
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        logros: usuario.logros
      }
    });

    res.status(200).json({
      message: "Visibilidad del logro actualizada",
      logro: usuario.logros[logroIndex]
    });
  } catch (error) {
    console.error("❌ Error actualizando visibilidad:", error);
    res.status(500).json({
      message: "Error al actualizar visibilidad del logro",
      error: error.message
    });
  }
};

export const obtenerProgresoReto = async (req, res) => {
  try {
    const { usuarioId, retoId } = req.params;

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    const reto = await prisma.reto.findUnique({ where: { id: retoId } });

    if (!usuario || !reto) {
      return res.status(404).json({ message: "Usuario o reto no encontrado" });
    }

    const progreso = {};
    
    for (const [key, valorRequerido] of Object.entries(reto.condiciones || {})) {
      const [categoria, subcategoria] = key.split(".");
      const valorActual = usuario.historial?.[categoria]?.[subcategoria] || 0;
      
      progreso[key] = {
        actual: valorActual,
        requerido: valorRequerido,
        porcentaje: Math.min(100, (valorActual / valorRequerido) * 100)
      };
    }

    res.status(200).json({
      reto: {
        id: reto.id,
        nombre: reto.nombre_reto,
        descripcion: reto.descripcion_reto
      },
      progreso: progreso
    });
  } catch (error) {
    console.error("❌ Error obteniendo progreso:", error);
    res.status(500).json({
      message: "Error al obtener progreso del reto",
      error: error.message
    });
  }
};

export const crearRetoManual = async (req, res) => {
  try {
    const {
      nombre_reto,
      descripcion_reto,
      fecha_inicio,
      condiciones,
      es_temporal
    } = req.body;

    const fechaInicio = fecha_inicio ? new Date(fecha_inicio) : new Date();
    const fechaFinal = new Date(fechaInicio.getTime() + 7 * 24 * 60 * 60 * 1000);

    const nuevoReto = await prisma.reto.create({
      data: {
        nombre_reto,
        descripcion_reto,
        fecha_inicio: fechaInicio,
        fecha_final: fechaFinal,
        condiciones: condiciones,
        es_temporal: es_temporal || false,
        estado: "activo"
      }
    });

    res.status(201).json({
      message: "Reto creado exitosamente",
      reto: nuevoReto
    });
  } catch (error) {
    console.error("❌ Error creando reto:", error);
    res.status(500).json({
      message: "Error al crear reto",
      error: error.message
    });
  }
};