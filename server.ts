import express from "express";
import path from "path";

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// Serve the Expo React Native Web export at root
app.use(express.static(path.join(process.cwd(), "dist-web")));

// Serve static engine files from assets/engine at /engine
const enginePath = path.join(process.cwd(), "android", "app", "src", "main", "assets", "engine");
app.use("/engine", express.static(enginePath));

// API routes FIRST
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "threekip-web" });
});

// Fallback for React Router in Expo Web
app.get("*", (req, res, next) => {
  if (req.url.startsWith("/engine/") || req.url.startsWith("/api/")) {
    return res.status(404).send("Not found");
  }
  res.sendFile(path.join(process.cwd(), "dist-web", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ThreeKip Web Server running on http://0.0.0.0:${PORT}`);
});
