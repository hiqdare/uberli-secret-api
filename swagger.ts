// swagger.ts
import swaggerUi from "swagger-ui-express";
import type { JsonObject } from "swagger-ui-express";
import fs from "node:fs";
import { parse } from "yaml";
import { type Request, type Response, type NextFunction, type Express } from "express";
import path from "node:path";

const OPENAPI_PATH = path.resolve("./openapi.yaml");

let swaggerDoc: JsonObject;
try {
  swaggerDoc = parse(fs.readFileSync(OPENAPI_PATH, "utf8")) as JsonObject;;
} catch (e) {
  console.error("Failed to load openapi.yaml:", e);
  swaggerDoc = { openapi: "3.0.0", info: { title: "Überli Secret API", version: "0.0.0" }, paths: {} } as JsonObject;;
}

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


export function mountDocs(app: Express) {
    const noindexNocache = (_req: Request, res: Response, next: NextFunction) => {
        res.setHeader("X-Robots-Tag", "noindex");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        next();
    };


    app.get("/docs/noindex.txt", (_req: Request, res: Response) => {
        res.type("text").send("User-agent: *\nDisallow: /");
    });

    app.use(
        "/docs",
        noindexNocache,
        docsGuard,
        swaggerUi.serve,
        swaggerUi.setup(swaggerDoc, {
            swaggerOptions: { displayRequestDuration: true, docExpansion: "list", tryItOutEnabled: false },
        })
    );

    app.get("/openapi.json", noindexNocache, docsGuard, (_req, res) => {
        res.type("application/json; charset=utf-8").send(JSON.stringify(swaggerDoc));
    });

    app.get("/openapi.yaml", noindexNocache, docsGuard, (_req, res) => {
        try {
            res.type("text/yaml; charset=utf-8").send(fs.readFileSync(OPENAPI_PATH, "utf8"));
        } catch {
            res.status(500).type("text/plain").send("openapi.yaml not found");
        }
    });
}
