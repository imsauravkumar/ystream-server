const DEFAULT_CLIENT_URLS = ["http://localhost:5173", "http://localhost:4173"];

export function getClientOrigins() {
  return (process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : DEFAULT_CLIENT_URLS)
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function corsOrigin(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  const allowedOrigins = getClientOrigins();
  if (allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS blocked origin: ${origin}`));
}
