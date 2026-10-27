import "dotenv/config";
import { z } from "zod";

// Treat blank values in .env (e.g. "MAX_PDF_PAGES=") as "not set"
const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

const positiveNumber = (fallback: number) =>
  z.preprocess(
    blankToUndefined,
    z.coerce.number().positive().default(fallback),
  );

const nonNegativeNumber = (fallback: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().min(0).default(fallback));

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // File storage (AWS S3, Cloudflare R2, or any S3-compatible provider)
  S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),
  S3_REGION: z.string().min(1, "S3_REGION is required"), // e.g. "ap-south-1", or "auto" for R2
  S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID is required"),
  S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY is required"),
  S3_ENDPOINT: z.string().optional(), // leave unset for AWS S3; set for R2 / others
  SIGNED_URL_EXPIRES_IN: z.coerce.number().default(3600), // seconds

  // Protects your free-tier storage and database
  MAX_DOCUMENTS_PER_USER: z.coerce.number().default(5),

  // AI / ingestion (Google Gemini API)
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  // Must match numDimensions in the Atlas Vector Search index
  EMBEDDING_DIMENSIONS: z.coerce.number().default(768),
  // Free-tier pacing: roughly how many tokens per minute you may embed.
  // Set to 0 to disable pacing (e.g. on a paid plan).
  EMBEDDING_TOKENS_PER_MINUTE: z.coerce.number().default(25000),

  MAX_PDF_PAGES: z.coerce.number().default(100),

  // Chat / RAG
  // Chat / RAG
  GEMINI_CHAT_MODEL: z.string().default("gemini-flash-latest"),
  RAG_TOP_K: positiveNumber(6), // chunks retrieved per question
  CHAT_HISTORY_MESSAGES: positiveNumber(6), // previous messages sent to the model

  // Security
  CORS_ORIGINS: z.string().default("http://localhost:3000"), // comma-separated browser origins
  TRUST_PROXY: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(0).default(0),
  ),

  // Rate limits
  RATE_LIMIT_LOGIN_ATTEMPTS: positiveNumber(10), // failed logins per email per 15 min
  RATE_LIMIT_SIGNUPS_PER_HOUR: positiveNumber(20),
  RATE_LIMIT_UPLOADS_PER_HOUR: positiveNumber(10), // per user
  RATE_LIMIT_CHAT_PER_MINUTE: positiveNumber(8), // per user
  RATE_LIMIT_CHAT_PER_DAY: positiveNumber(100), // per user
  RATE_LIMIT_GLOBAL_CHAT_PER_MINUTE: positiveNumber(20), // all users together
  RATE_LIMIT_API_PER_MINUTE: positiveNumber(120), // per user, every authenticated route
});

export const env = envSchema.parse(process.env);
