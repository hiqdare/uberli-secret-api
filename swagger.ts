import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import type { Request, Response, NextFunction } from "express";

const swaggerDoc = YAML.load("./openapi.yaml");

// einfache Gate-Middleware: nur Admin-Group/Scope
function docsGuard(req: Request, res: Response, next: NextFunction) {
  // Wenn du bereits Entra ID Middleware hast, prüfe hier den Scope/Role:
  // Beispiel minimal: erlauben nur aus internem Netz / bestimmtem Header
  const allow = process.env.NODE_ENV !== "production" 
             || (req.headers["x-docs-key"] && req.headers["x-docs-key"] === process.env.DOCS_KEY);
  if (!allow) return res.status(403).send("Forbidden");
  next();
}

export function mountDocs(app) {
  app.get("/docs/noindex.txt", (_req,res)=>res.type("text").send("User-agent: *\nDisallow: /"));
  app.use("/docs", docsGuard, swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
    swaggerOptions: {
      displayRequestDuration: true,
      docExpansion: "list",
      tryItOutEnabled: false,   // in Prod oft deaktiviert
    }
  }));
  app.get("/openapi.json", docsGuard, (_req,res)=>res.json(swaggerDoc));
}
