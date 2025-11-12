import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatRouter from "./routes/chat.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/chat", chatRouter);

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Nyomi AI backend is running",
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🤍 Nyomi AI backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
