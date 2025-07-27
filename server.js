import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './api.js'; // falls du API-Routen ausgelagert hast

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use('/api', apiRoutes); // oder direkt API-Handler einfügen

// Static Frontend
const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));

// SPA routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
