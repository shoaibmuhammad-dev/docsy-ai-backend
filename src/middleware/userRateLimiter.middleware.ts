import { rateLimit } from "express-rate-limit";
import ApiError from "../utils/ApiError.js";

const userRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 requests per user per minute

  // Identify each user by their authenticated ID.
  keyGenerator: (req) => {
    if (!req.user?.id) {
      throw new ApiError(
        "userRateLimiter requires authenticated requests",
        429,
      );
    }

    return String(req.user.id);
  },

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again in a minute.",
  },
});

export default userRateLimiter;
