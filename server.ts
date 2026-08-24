import express from "express";
import path from "path";

const app = express();
const PORT = 3000;

const ROOT = process.cwd();
const enginePath = path.join(ROOT, "assets", "engine");
const webPath = path.join(ROOT, "web");

// Engine 3D served under /engine so its relative asset paths (js/, assets/, sw.js) resolve.
app.use("/engine", express.static(enginePath));
// Static assets for the web shell (css/js).
app.use("/web", express.static(webPath));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "threekip-web" });
});

// Desktop (Library) shell at the root.
app.get("/", (_req, res) => {
  res.sendFile(path.join(webPath, "desktop.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ThreeKip Web Server running on http://0.0.0.0:${PORT}`);
});
