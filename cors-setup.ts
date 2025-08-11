// cors-setup.ts
import cors from "cors";

const allowed = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

export const corsMiddleware = cors({
  origin: function (origin, cb) {
    // allow same-origin / curl / server-side (no Origin header)
    if (!origin) return cb(null, true);
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error("CORS not allowed"));
  },
  methods: ["GET","POST","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false, // keine Cookies nötig
  maxAge: 600,        // Preflight 10min cachen
});
