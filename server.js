const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5000;

// Uploads folder
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

let files = []; // store file metadata

// Middleware
app.use(express.static("public"));
app.use(express.json());

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Helper: get device info
function getDeviceInfo() {
  const hostname = os.hostname();
  const platform = os.platform();
  const release = os.release();

  let osName;
  if (platform === "win32") osName = "Windows " + release;
  else if (platform === "darwin") osName = "macOS " + release;
  else osName = "Linux " + release;

  return `${hostname} (${osName})`;
}

// Upload route
app.post("/upload", upload.single("file"), (req, res) => {
  const { pin, nickname } = req.body;
  if (!pin) return res.status(400).json({ error: "PIN is required" });

  const meta = {
    name: req.file.originalname,
    stored: req.file.filename,
    size: req.file.size,
    device: getDeviceInfo(),
    nickname: nickname || "",
    pin,
    time: new Date().toISOString()
  };

  files.push(meta);

  console.log("📂 New file uploaded:", meta);
  console.log("📂 Current files:", files.length);

  io.emit("update", files);
  res.json({ success: true });
});

// Download route
app.post("/download", (req, res) => {
  const { filename, pin } = req.body;
  const file = files.find(f => f.stored === filename);

  if (!file) return res.status(404).json({ error: "File not found" });
  if (file.pin !== pin) return res.status(403).json({ error: "Invalid PIN" });

  const filePath = path.join(UPLOAD_DIR, filename);
  console.log(`⬇️ Downloaded: ${file.name} by ${file.device}`);
  res.download(filePath, file.name);
});

// Delete route
app.post("/delete", (req, res) => {
  const { filename, pin } = req.body;
  const file = files.find(f => f.stored === filename);

  if (!file) return res.status(404).json({ error: "File not found" });
  if (file.pin !== pin) return res.status(403).json({ error: "Invalid PIN" });

  fs.unlinkSync(path.join(UPLOAD_DIR, filename));
  files = files.filter(f => f.stored !== filename);

  console.log(`🗑️ Deleted: ${file.name} by ${file.device}`);
  io.emit("update", files);
  res.json({ success: true });
});

// Socket.IO connections
io.on("connection", socket => {
  console.log("🔗 Client connected");
  socket.emit("update", files);
});

// Start server (Render uses this)
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 UTransfer running at http://localhost:${PORT}`);
});
