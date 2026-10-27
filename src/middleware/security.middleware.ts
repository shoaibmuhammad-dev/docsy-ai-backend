import cors from "cors";
import helmet from "helmet";
import { env } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

// "http://localhost:3000, https://my-app.vercel.app/" -> a clean list without trailing slashes
const allowedOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Security headers (no sniffing, no framing, HSTS, hides "X-Powered-By"...)
export const helmetMiddleware = helmet();

// Which BROWSER origins may call this API. Your Next.js server, Postman and curl
// send no Origin header, so they are not affected. A browser on any other site
// is rejected before anything runs. No `credentials`: the API uses a Bearer
// header, not cookies.
export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new ApiError("This origin is not allowed", 403));
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600, // browsers may cache the preflight answer for 10 minutes
});
