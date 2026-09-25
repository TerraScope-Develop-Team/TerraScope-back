export const respondWithError = (res, status, code, message, details) => {
  return res.status(status).json({
    status,
    code,
    message,
    ...(details ? { details } : {})
  });
};

export const respondWithControllerError = (res, error, defaultMessage, defaultStatus = 500) => {
  console.error(defaultMessage, error);

  if (error.name === "ValidationError" || error.name === "CastError") {
    const details = error.name === "ValidationError"
      ? Object.values(error.errors).map(({ path, message }) => ({ path, message }))
      : undefined;

    return respondWithError(
      res,
      400,
      error.name === "CastError" ? "INVALID_OBJECT_ID" : "VALIDATION_ERROR",
      error.name === "CastError" ? "El identificador tiene un formato inválido" : "Los datos enviados no son válidos",
      details
    );
  }

  if (error.code === 11000) {
    return respondWithError(res, 409, "DUPLICATE_RESOURCE", "El recurso ya existe");
  }

  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 600) {
    return respondWithError(
      res,
      error.statusCode,
      error.code || "REQUEST_ERROR",
      error.publicMessage || defaultMessage
    );
  }

  return respondWithError(res, defaultStatus, "INTERNAL_SERVER_ERROR", defaultMessage);
};