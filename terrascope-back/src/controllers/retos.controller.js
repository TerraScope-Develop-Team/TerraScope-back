import {
  crearRetoManualService,
  desinscribirseRetoService,
  getProgresoRetoService,
  getRetoByIdService,
  getRetosActivosService,
  getTablaPosicionesService,
  getUserLogrosService,
  inscribirseRetoService,
  isValidObjectId,
  toggleMostrarLogroService,
  validateRetoInscripcion,
} from "../services/retos.service.js";

export const obtenerRetosActivos = async (req, res) => {
  try {
    const retos = await getRetosActivosService();
    res.status(200).json(retos);
  } catch (error) {
    console.error("❌ Error obteniendo retos:", error);
    res.status(500).json({
      message: "Error al obtener retos activos",
      error: error.message,
    });
  }
};

export const obtenerRetoById = async (req, res) => {
  try {
    const reto = await getRetoByIdService({ retoId: req.params.id });

    if (!reto) {
      return res.status(404).json({ message: "Reto no encontrado" });
    }

    res.status(200).json(reto);
  } catch (error) {
    console.error("❌ Error obteniendo reto:", error);
    res.status(500).json({
      message: "Error al obtener reto",
      error: error.message,
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

    const result = await inscribirseRetoService({ retoId, usuarioId });

    res.status(200).json({
      message: result.yaInscrito ? "Ya estabas inscrito en el reto" : "Inscripción exitosa",
      reto: result.retoActualizado,
      usuarioId: result.usuarioId,
    });
  } catch (error) {
    console.error("❌ Error inscribiendo en reto:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al inscribirse en el reto",
      error: error.message,
    });
  }
};

export const desinscribirseReto = async (req, res) => {
  try {
    let retoId;
    let usuarioId;

    try {
      ({ retoId, usuarioId } = validateRetoInscripcion(req.body || {}));
    } catch (error) {
      const message = error.message === 'Se requiere un ID de usuario válido'
        ? 'Se requiere un ID de usuario válido'
        : 'Se requiere un ID de reto válido';
      return res.status(400).json({ message });
    }

    await desinscribirseRetoService({ retoId, usuarioId });
    res.status(200).json({ message: "Desinscripción exitosa" });
  } catch (error) {
    console.error("❌ Error desinscribiendo del reto:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al desinscribirse del reto",
      error: error.message,
    });
  }
};

export const obtenerTablaPosiciones = async (req, res) => {
  try {
    const { retoId } = req.params;
    const result = await getTablaPosicionesService({ retoId });

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error obteniendo tabla de posiciones:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al obtener tabla de posiciones",
      error: error.message,
    });
  }
};

export const obtenerLogrosUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const result = await getUserLogrosService({ usuarioId });
    res.status(200).json(result.payload);
  } catch (error) {
    console.error("❌ Error obteniendo logros:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al obtener logros del usuario",
      error: error.message,
    });
  }
};

export const toggleMostrarLogro = async (req, res) => {
  try {
    const { usuarioId, logroId } = req.body;
    const result = await toggleMostrarLogroService({ usuarioId, logroId });

    res.status(200).json({
      message: result.message,
      logro: result.logro,
    });
  } catch (error) {
    console.error("❌ Error actualizando visibilidad:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al actualizar visibilidad del logro",
      error: error.message,
    });
  }
};

export const obtenerProgresoReto = async (req, res) => {
  try {
    const { usuarioId, retoId } = req.params;
    const result = await getProgresoRetoService({ usuarioId, retoId });
    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error obteniendo progreso:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al obtener progreso del reto",
      error: error.message,
    });
  }
};

export const crearRetoManual = async (req, res) => {
  try {
    const nuevoReto = await crearRetoManualService(req.body || {});

    res.status(201).json({
      message: "Reto creado exitosamente",
      reto: nuevoReto,
    });
  } catch (error) {
    console.error("❌ Error creando reto:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      message: error.message || "Error al crear reto",
      error: error.message,
    });
  }
};