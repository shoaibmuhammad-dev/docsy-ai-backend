import type { Request } from "express";
import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import { env } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Your browser never calls Express: the Next.js server does. So every request
// arrives from the Next.js server's address, and limiting by IP would throttle
// ALL users together. These limiters key on the logged-in user (or the email
// for login) instead.
const clientKey = (req: Request) => ipKeyGenerator(req.ip ?? "unknown");

const userKey = (req: Request) => req.user?.id ?? clientKey(req);

const emailKey = (req: Request) => {
  const email: unknown = req.body?.email;
  return typeof email === "string" && email
    ? email.trim().toLowerCase()
    : clientKey(req);
};

// A rejected request goes through your normal error middleware, so it looks
// like every other error: { success: false, error: "..." } with status 429
const reject =
  (message: string): Options["handler"] =>
  (_req, _res, next) =>
    next(new ApiError(message, 429));

// RateLimit-* headers tell clients how many requests are left; Retry-After is
// added automatically when a request is rejected
const common = { standardHeaders: "draft-7", legacyHeaders: false } as const;

// ---------------------------------------------------------------------------
// Public routes (nobody is logged in yet)
// ---------------------------------------------------------------------------

// POST /auth/login: stops password guessing. Only FAILED attempts count, per email.
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * MINUTE,
  limit: env.RATE_LIMIT_LOGIN_ATTEMPTS,
  skipSuccessfulRequests: true,
  keyGenerator: emailKey,
  handler: reject(
    "Too many failed login attempts. Please try again in 15 minutes.",
  ),
});

// POST /auth/signup: a safety valve against mass account creation
export const signupLimiter = rateLimit({
  ...common,
  windowMs: HOUR,
  limit: env.RATE_LIMIT_SIGNUPS_PER_HOUR,
  keyGenerator: clientKey,
  handler: reject("Too many sign-up attempts. Please try again later."),
});

// ---------------------------------------------------------------------------
// Authenticated routes (put these AFTER authMiddleware so req.user exists)
// ---------------------------------------------------------------------------

// Every authenticated route: a cheap ceiling for everything else
export const apiLimiter = rateLimit({
  ...common,
  windowMs: MINUTE,
  limit: env.RATE_LIMIT_API_PER_MINUTE,
  keyGenerator: userKey,
  handler: reject("Too many requests. Please slow down."),
});

// POST /documents: each upload costs storage, parsing and embedding calls
export const uploadLimiter = rateLimit({
  ...common,
  windowMs: HOUR,
  limit: env.RATE_LIMIT_UPLOADS_PER_HOUR,
  keyGenerator: userKey,
  handler: reject(
    "You've uploaded too many files recently. Please try again later.",
  ),
});

// POST /chats/:id/messages: every message calls the embedding API and Gemini.
// Use these three in this order: per-user checks first, the shared one last,
// so a user who is already blocked doesn't use up everyone's shared budget.
export const chatPerMinuteLimiter = rateLimit({
  ...common,
  windowMs: MINUTE,
  limit: env.RATE_LIMIT_CHAT_PER_MINUTE,
  keyGenerator: userKey,
  handler: reject("You're sending messages too quickly. Please wait a moment."),
});

export const chatPerDayLimiter = rateLimit({
  ...common,
  windowMs: DAY,
  limit: env.RATE_LIMIT_CHAT_PER_DAY,
  keyGenerator: userKey,
  handler: reject(
    "You've reached today's message limit. Please come back tomorrow.",
  ),
});

// One shared budget for ALL users, sized to your free Gemini quota
export const geminiGlobalLimiter = rateLimit({
  ...common,
  windowMs: MINUTE,
  limit: env.RATE_LIMIT_GLOBAL_CHAT_PER_MINUTE,
  keyGenerator: () => "all-users",
  handler: reject(
    "The AI service is busy right now. Please try again in a minute.",
  ),
});
