import Reto from "../models/reto.model.js";
import Usuario from "../models/usuario.model.js";
import retosService from "../services/retos.service.js";

export const obtenerRetosActivos = async (req, res) => {
  try {
    const retos = await Reto.find({ estado: "activo" })
      .sort({ createdAt: -1 });
    
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
    const reto = await Reto.findById(req.params.id);
    
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
    const { retoId, usuarioId } = req.body;
    
    if (!usuarioId) {
      return res.status(400).json({ message: "Se requiere el ID del usuario" });
    }

    const reto = await Reto.findById(retoId);
    const usuario = await Usuario.findById(usuarioId);

    if (!reto || !usuario) {
      return res.status(404).json({ message: "Reto o usuario no encontrado" });
    }

    if (reto.estado !== "activo") {
      return res.status(400).json({ message: "Este reto no está activo" });
    }

    const yaInscrito = reto.usuarios_inscritos.includes(usuarioId);
    if (yaInscrito) {
      return res.status(400).json({ message: "Ya estás inscrito en este reto" });
    }

    reto.usuarios_inscritos.push(usuarioId);
    await reto.save();

    usuario.retos_activos.push(retoId);
    await usuario.save();

    res.status(200).json({
      message: "Inscripción exitosa",
      reto: reto
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
    const { retoId, usuarioId } = req.body;

    const reto = await Reto.findById(retoId);
    const usuario = await Usuario.findById(usuarioId);

    if (!reto || !usuario) {
      return res.status(404).json({ message: "Reto o usuario no encontrado" });
    }

    reto.usuarios_inscritos = reto.usuarios_inscritos.filter(
      id => id.toString() !== usuarioId.toString()
    );
    await reto.save();

    usuario.retos_activos = usuario.retos_activos.filter(
      id => id.toString() !== retoId.toString()
    );
    await usuario.save();

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
    
    const reto = await Reto.findById(retoId)
      .populate('usuarios_finalizados.usuario_id', 'nombre_usuario imagen_perfil');

    if (!reto) {
      return res.status(404).json({ message: "Reto no encontrado" });
    }

    const top3 = reto.usuarios_finalizados
      .sort((a, b) => a.posicion - b.posicion)
      .slice(0, 3)
      .map(u => ({
        usuario: u.usuario_id,
        posicion: u.posicion,
        fecha_completado: u.fecha_completado
      }));

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
    
    const usuario = await Usuario.findById(usuarioId)
      .populate('logros.id_reto_base', 'nombre_reto descripcion_reto');

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({
      logros: usuario.logros,
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

    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const logro = usuario.logros.id(logroId);
    if (!logro) {
      return res.status(404).json({ message: "Logro no encontrado" });
    }

    logro.es_mostrado = !logro.es_mostrado;
    await usuario.save();

    res.status(200).json({
      message: "Visibilidad del logro actualizada",
      logro: logro
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

    const usuario = await Usuario.findById(usuarioId);
    const reto = await Reto.findById(retoId);

    if (!usuario || !reto) {
      return res.status(404).json({ message: "Usuario o reto no encontrado" });
    }

    const progreso = {};
    
    for (const [key, valorRequerido] of Object.entries(reto.condiciones)) {
      const [categoria, subcategoria] = key.split(".");
      const valorActual = usuario.historial[categoria]?.[subcategoria] || 0;
      
      progreso[key] = {
        actual: valorActual,
        requerido: valorRequerido,
        porcentaje: Math.min(100, (valorActual / valorRequerido) * 100)
      };
    }

    res.status(200).json({
      reto: {
        id: reto._id,
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
      fecha_final,
      condiciones,
      es_temporal
    } = req.body;

    const nuevoReto = new Reto({
      nombre_reto,
      descripcion_reto,
      fecha_inicio: fecha_inicio || new Date(),
      fecha_final,
      condiciones: condiciones,
      es_temporal: es_temporal || false,
      estado: "activo"
    });

    await nuevoReto.save();

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
