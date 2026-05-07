import admin from "../config/firebase.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Missing Firebase token." });
    }

    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch (error) {
    next(Object.assign(new Error("Invalid Firebase token."), { statusCode: 401, cause: error }));
  }
}

export async function verifySocketToken(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Missing Firebase token."));
    socket.user = await admin.auth().verifyIdToken(token);
    next();
  } catch (error) {
    next(new Error("Invalid Firebase token."));
  }
}
