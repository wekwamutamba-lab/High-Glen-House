export function errorHandler(err, req, res, next) {
  console.error("Error:", err);

  if (err.name === "PrismaClientKnownRequestError") {
    return res.status(400).json({
      success: false,
      message: "Database operation failed",
    });
  }

  if (err.name === "PrismaClientValidationError") {
    return res.status(400).json({
      success: false,
      message: "Invalid database query",
    });
  }

  if (err.name === "FirebaseError") {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production" && statusCode === 500
      ? "Internal server error"
      : err.message || "Internal server error";

  return res.status(statusCode).json({
    success: false,
    message,
  });
}
