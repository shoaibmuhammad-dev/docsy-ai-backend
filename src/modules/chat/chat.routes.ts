import express from "express";
import { validate } from "../../middleware/validate.middleware.js";
import {
  createChatSchema,
  sendMessageSchema,
} from "../../validators/chat.validator.js";
import {
  createChat,
  deleteChat,
  getChat,
  getChats,
  sendMessage,
} from "./chat.controller.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import userRateLimiter from "../../middleware/userRateLimiter.middleware.js";

const router = express.Router();

// Every chat route requires a logged-in user
router.use(authMiddleware);

router.post("/", validate(createChatSchema), createChat);
router.get("/", getChats);
router.get("/:id", getChat);
router.delete("/:id", deleteChat);
router.post(
  "/:id/messages",
  validate(sendMessageSchema),
  userRateLimiter,
  sendMessage,
);

export default router;
