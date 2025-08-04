import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

// Allow only your frontend origins (use env var so you can add SWA + custom domain)
const allowed = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);
app.use(cors({
  origin: allowed.length ? allowed : true, // true means allow all during initial bring-up
  credentials: false
}));

const secrets = new Map();

app.post("/api/secret", (req, res) => {
  const { value } = req.body || {};
  if (!value) return res.status(400).json({ error: "value required" });
  const id = uuidv4();
  secrets.set(id, { value, created: Date.now() });
  res.json({ id });
});

app.get("/api/secret/:id", (req, res) => {
  const secret = secrets.get(req.params.id);
  if (secret) {
    secrets.delete(req.params.id);
    res.json({ value: secret.value });
  } else {
    res.status(404).json({ error: "Not found or already retrieved." });
  }
});

// simple health endpoint
app.get("/health", (_req, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Secret API running on ${port}`);
});
