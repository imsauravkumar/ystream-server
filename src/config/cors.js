const DEFAULT_CLIENT_URLS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://ystream-client.vercel.app",
  "https://video-call-client-kappa.vercel.app",
  "https://mesaurav.in",
  "https://www.mesaurav.in"
];

function normalizeOrigin(origin) {
  const value = String(origin || "").trim().replace(/\/+$/, "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function getClientOrigins() {
  const configuredOrigins = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : [];
  return [...new Set([...DEFAULT_CLIENT_URLS, ...configuredOrigins].map(normalizeOrigin).filter(Boolean))];
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
