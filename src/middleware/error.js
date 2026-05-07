export function notFound(req, _res, next) {
  next(Object.assign(new Error(`Not found: ${req.originalUrl}`), { statusCode: 404 }));
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: error.message || "Server error"
  });
}
