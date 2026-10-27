import dotenv from "dotenv";
import express from "express";
dotenv.config();

const app = express();

import errorMiddleware from "./middleware/error.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";
import documentRoutes from "./modules/document/document.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import {
  corsMiddleware,
  helmetMiddleware,
} from "./middleware/security.middleware.js";

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

app.get("/health", (_req, res) => {
  res.json({ success: true });
}); // for hosting health checks

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/chats", chatRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

app.use(errorMiddleware);

export default app;
