import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { getContainers } from './cosmos.js';

console.log('ENV-CHECK', {
  COSMOS_ENDPOINT: process.env.COSMOS_ENDPOINT,
  COSMOS_KEY: !!process.env.COSMOS_KEY,          // nicht den Key selbst loggen!
  COSMOS_DB: process.env.COSMOS_DB
});

const app = express();
app.set('trust proxy', true); // richtige Client-IP aus x-forwarded-for
app.use(express.json());

// Allow only your frontend origins (use env var so you can add SWA + custom domain)
const allowed = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);
app.use(cors({
  origin: allowed.length ? allowed : true, // true means allow all during initial bring-up
  credentials: false
}));

app.post("/api/secret", async (req, res) => {
  const { value, ttlSeconds } = req.body || {};
  if (!value) return res.status(400).json({ error: "value required" });

  const id  = uuidv4();
  const now = Date.now();
  const ttl = Number.isFinite(ttlSeconds) ? Math.max(60, ttlSeconds) : undefined;

  // secrets: nur der verschlüsselte Wert + Meta für Ablauf
  const secretDoc = {
    id,
    value,          // verschlüsselt (vom Frontend)
    createdAt: now,
    ...(ttl ? { ttl } : {}) // überschreibt Container-Default, falls gesetzt
  };

  // stats: alles für Auswertung, aber KEIN value
  const statsDoc = {
    id,
    createdAt: now,
    expiresAt: ttl ? now + ttl * 1000 : null,
    retrievedAt: null,
    // Platzhalter für spätere Meta (ipHash, country, ua, lang)
    metaCreate: null,
    metaRead:   null
  };

  const { secrets, stats } = await getContainers();

  try {
    await Promise.all([
      secrets.items.create(secretDoc),
      stats.items.upsert(statsDoc) // upsert falls du mehrmals speicherst
    ]);
    res.json({ id });
  } catch (e) {
    console.error('cosmos create failed', e);
    res.status(500).json({ error: "store failed" });
  }
});

app.get("/api/secret/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { secrets, stats } = await getContainers(); // lazy init
    const { resource: s } = await secrets.item(id, id).read();
    if (!s) return res.status(404).json({ error: "Not found or already retrieved." });

    // 2) sofort antworten
    res.json({ value: s.value });

    // 3) cleanup nebenläufig
    secrets.item(id, id).delete().catch(err => console.error("delete failed", err));
    stats.item(id, id).patch([{ op: "add", path: "/retrievedAt", value: Date.now() }])
      .catch(err => console.error("stats patch failed", err));

  } catch (e) {
    if (e.code === 404) {
      return res.status(404).json({ error: "Not found or already retrieved." });
    }
    console.error("cosmos read failed", e);
    return res.status(500).json({ error: "read failed" }); // <-- wichtig: immer antworten
  }
});


// Health ohne DB (für App Service Health Check)
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// Optional: Readiness mit DB
app.get("/readyz", async (_req, res) => {
  try {
    // leichte DB-Operation, wenn du willst:
    // const { resources } = await secrets.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
    res.status(200).send("ready");
  } catch {
    res.status(503).send("db-not-ready");
  }
});

// >>> WICHTIG: Server starten (PORT aus ENV)
const port = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(port, () => {
  console.log(`api up on :${port}`);
});

app.use((err, _req, res, _next) => {
  console.error("ERR", err);
  res.status(500).json({ error: "internal_error" });
});


// harte Crashes sichtbar loggen
process.on("unhandledRejection", (r) => console.error("UNHANDLED_REJECTION", r));
process.on("uncaughtException", (e) => console.error("UNCAUGHT_EXCEPTION", e));
