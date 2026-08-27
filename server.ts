import express from "express";
import path from "path";

const app = express();
const PORT = 3000;

// Serve the Expo React Native Web export at root
app.use(express.static(path.join(process.cwd(), "dist-web")));

// Serve static engine files from assets/engine at /engine
const enginePath = path.join(process.cwd(), "assets", "engine");
app.use("/engine", express.static(enginePath));

// Fallback for React Router in Expo Web
app.get("*", (req, res) => {
  if (req.url.startsWith("/engine/") || req.url.startsWith("/api/")) {
    return;
  }
  res.sendFile(path.join(process.cwd(), "dist-web", "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "threekip-web" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ThreeKip Web Server running on http://0.0.0.0:${PORT}`);
});
