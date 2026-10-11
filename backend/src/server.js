
import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { Server } from "socket.io";

const app = express();
const httpServer = http.createServer(app);

const allowedOrigin =
  process.env.CLIENT_URL || "http://localhost:5173";

app.use(helmet());

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ChatWave API",
  });
});

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigin,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

const port = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("MongoDB connected");
    } else {
      console.warn(
        "MONGODB_URI missing; database features are not ready."
      );
    }

    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`ChatWave API running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start ChatWave:", error.message);
    process.exit(1);
  }
}

startServer();
