// swagger.ts
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { type Request, type Response, type NextFunction, type Express } from "express";

const OPENAPI_PATH = path.resolve("./openapi.yaml");

// Spec einmalig laden (mit Fallback)
function loadSpec(): any {
    try {
        return YAML.parse(fs.readFileSync(OPENAPI_PATH, "utf8"));
    } catch (e) {
        console.error("Failed to load openapi.yaml:", e);
        return { openapi: "3.0.0", info: { title: "Uberli Secret API", version: "0.0.0" }, paths: {} };
    }
}
const swaggerDoc = loadSpec();

// Guard: Header ODER Query-Param ?key=… (für Browser)
function docsGuard(req: Request, res: Response, next: NextFunction) {
    const keyFromHeader = req.headers["x-docs-key"];
    const keyFromQuery = typeof req.query.key === "string" ? req.query.key : undefined;
    const allow =
        process.env.NODE_ENV !== "production" ||
        keyFromHeader === process.env.DOCS_KEY ||
        keyFromQuery === process.env.DOCS_KEY;
    if (!allow) return res.status(403).send("Forbidden");
    next();
}

// Noindex & Nocache-Header nur für Docs/Spec
const noindexNocache = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Robots-Tag", "noindex");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    next();
};

export function mountDocs(app: Express) {
    // robots-Hinweis (optional)
    app.get("/docs/noindex.txt", (_req, res) => {
        res.type("text").send("User-agent: *\nDisallow: /");
    });

    // Scalar UI (CDN) – lädt deine Spec von /openapi.json
    app.get("/docs", noindexNocache, docsGuard, (_req, res) => {
        const queryKey = encodeURIComponent(process.env.DOCS_KEY || "");
        const specUrl = `/openapi.json?key=${queryKey}`;
        res.type("html").send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Uberli Secret API – Docs</title>
    <style>html,body,#app{height:100%;margin:0}</style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        theme: 'purple',          // optional
        layout: 'modern',         // optional
        darkMode: true,           // optional
        hideDownloadButton: false,
        url: '${specUrl}'         // lädt deine Spec (mit key)
      });
    </script>
  </body>
</html>`);
    });

    // Spec: JSON
    app.get("/openapi.json", noindexNocache, docsGuard, (_req, res) => {
        res.type("application/json; charset=utf-8").send(JSON.stringify(swaggerDoc));
    });

    // Spec: YAML (praktisch für Tools)
    app.get("/openapi.yaml", noindexNocache, docsGuard, (_req, res) => {
        try {
            res.type("text/yaml; charset=utf-8").send(fs.readFileSync(OPENAPI_PATH, "utf8"));
        } catch {
            res.status(500).type("text/plain").send("openapi.yaml not found");
        }
    });
}
