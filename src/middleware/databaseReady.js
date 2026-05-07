import { isDatabaseReady } from "../config/database.js";

export function requireDatabase(req, res, next) {
  if (!isDatabaseReady()) {
    return res.status(503).json({
      message: "Database is not connected yet. Check MONGODB_URI and MongoDB Atlas network access."
    });
  }

  next();
}
