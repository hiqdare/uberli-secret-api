import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json());

const secrets = new Map();

app.post("/api/secret", (req, res) => {
  const { value } = req.body;
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

app.listen(3001, () => console.log("Secret API on http://localhost:3001"));
