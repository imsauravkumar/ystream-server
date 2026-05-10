const DEFAULT_CLIENT_URLS = ["http://localhost:5173", "http://localhost:4173"];

function normalizeOrigin(origin) {
  const value = String(origin || "").trim().replace(/\/+$/, "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function getClientOrigins() {
  return (process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : DEFAULT_CLIENT_URLS)
    .map(normalizeOrigin)
    .filter(Boolean);
}

export function corsOrigin(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  const allowedOrigins = getClientOrigins();
  if (allowedOrigins.includes(normalizeOrigin(origin))) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS blocked origin: ${origin}`));
}
