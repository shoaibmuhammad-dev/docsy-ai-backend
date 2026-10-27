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
import {
  apiLimiter,
  chatPerDayLimiter,
  chatPerMinuteLimiter,
  geminiGlobalLimiter,
} from "../../middleware/rateLimit.middleware.js";

const router = express.Router();

// Every chat route requires a logged-in user
router.use(authMiddleware, apiLimiter);

router.post("/", validate(createChatSchema), createChat);
router.get("/", getChats);
router.get("/:id", getChat);
router.delete("/:id", deleteChat);
router.post(
  "/:id/messages",
  chatPerMinuteLimiter,
  chatPerDayLimiter,
  geminiGlobalLimiter,
  validate(sendMessageSchema),
  userRateLimiter,
  sendMessage,
);

export default router;
