// index.ts
import express, { type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { getContainers } from "./cosmos.js";
import { mountDocs } from "./swagger.js";
import { corsMiddleware } from "./cors-setup.js";
import 'dotenv/config';

const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use(corsMiddleware);

app.get("/healthz", (_req: Request, res: Response) => res.status(200).send("ok"));

app.post("/api/secret", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body ?? {}) as { value?: string; ttlSeconds?: number };
    if (!body.value) return res.status(400).json({ error: "value required" });

    const id = crypto.randomUUID();
    const now = Date.now();
    const ttl =
      Number.isFinite(body.ttlSeconds) && typeof body.ttlSeconds === "number"
        ? Math.max(60, body.ttlSeconds)
        : undefined;

    const secretDoc = { id, value: body.value, createdAt: now, ...(ttl ? { ttl } : {}) };
    const statsDoc = {
      id,
      createdAt: now,
      expiresAt: ttl ? now + ttl * 1000 : null,
      retrievedAt: null,
      metaCreate: null,
      metaRead: null,
    };

    const { secrets, stats } = await getContainers();
    await Promise.all([secrets.items.create(secretDoc), stats.items.upsert(statsDoc)]);
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

app.get("/api/secret/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  try {
    const { secrets, stats } = await getContainers();
    const { resource: s } = await secrets.item(id, id).read();
    if (!s) return res.status(404).json({ error: "Not found or already retrieved." });

    res.json({ value: (s as any).value }); // sofort antworten

    // Nebenläufige Aufräumer
    secrets.item(id, id).delete().catch((err: unknown) => console.error("delete failed", err));
    stats
      .item(id, id)
      .patch([{ op: "add", path: "/retrievedAt", value: Date.now() }])
      .catch((err: unknown) => console.error("stats patch failed", err));
  } catch (e: unknown) {
    const err = e as { code?: number | string };
    if (err?.code === 404) {
      return res.status(404).json({ error: "Not found or already retrieved." });
    }
    console.error("cosmos read failed", e);
    return res.status(500).json({ error: "read failed" });
  }
});

// Swagger mount (Guard inside)
mountDocs(app);

// Globaler Fehler-Handler (Parameter getypt)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("ERR", err);
  res.status(500).json({ error: "internal_error" });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`api up on :${port}`));

process.on("unhandledRejection", (r) => console.error("UNHANDLED_REJECTION", r));
process.on("uncaughtException", (e) => console.error("UNCAUGHT_EXCEPTION", e));
