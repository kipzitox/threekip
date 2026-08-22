import express from "express";
import path from "path";

const app = express();
const PORT = 3000;

// Serve static engine files from assets/engine
const enginePath = path.join(process.cwd(), "assets", "engine");
app.use(express.static(enginePath));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "threekip-web" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ThreeKip Web Server running on http://0.0.0.0:${PORT}`);
});
