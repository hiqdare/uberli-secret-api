import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { secrets, stats } from './cosmos.js';

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
    // 1) Secret holen
    const { resource: s } = await secrets.item(id, id).read();
    if (!s) return res.status(404).json({ error: "Not found or already retrieved." });

    // Optional: harte Ablaufprüfung, falls du expiresAt im secrets-Dokument führst
    // if (s.expiresAt && Date.now() > s.expiresAt) { ... }

    // 2) Value an Client senden
    res.json({ value: s.value });

    // 3) Danach löschen (Einmaligkeit). TTL würde es zwar auch löschen,
    //    aber so ist das Secret sofort weg.
    secrets.item(id, id).delete().catch(() => {});

    // 4) stats aktualisieren (retrievedAt setzen; metaRead kommt später)
    const { resource: st } = await stats.item(id, id).read().catch(() => ({ resource: null }));
    const patch = [
      { op: 'add', path: '/retrievedAt', value: Date.now() }
    ];
    if (st) {
      await stats.item(id, id).patch(patch).catch(() => {});
    } else {
      // Falls stats-Dokument wider Erwarten fehlt: neu anlegen ohne value
      await stats.items.create({ id, createdAt: null, retrievedAt: Date.now(), expiresAt: null });
    }
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: "Not found or already retrieved." });
    console.error('cosmos read/delete/patch failed', e);

  }
});
