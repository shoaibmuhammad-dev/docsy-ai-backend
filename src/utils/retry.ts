import { setTimeout as sleep } from "node:timers/promises";
import ApiError from "./ApiError.js";

// Network-level failures. Node's fetch throws "TypeError: fetch failed" and
// puts the real reason in error.cause.code
const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const getStatus = (error: unknown): number | undefined =>
  (error as { status?: number }).status;

const getNetworkCode = (error: unknown): string | undefined =>
  (error as { cause?: { code?: string } }).cause?.code;

export const isNetworkError = (error: unknown): boolean => {
  const code = getNetworkCode(error);
  return code !== undefined && TRANSIENT_NETWORK_CODES.has(code);
};

export const isRetryable = (error: unknown): boolean => {
  const status = getStatus(error);
  return (
    status === 429 || status === 500 || status === 503 || isNetworkError(error)
  );
};

interface RetryOptions {
  label: string; // shown in the log line, e.g. "embed"
  maxAttempts?: number;
  baseDelayMs?: number; // delay doubles each attempt: 5s, 10s, 20s...
  signal?: AbortSignal; // stop waiting/retrying if the client went away
}

// Retries rate-limit (429), temporary server errors and network drops.
// Anything else (bad key, bad request...) is thrown immediately.
export const withRetry = async <T>(
  operation: () => Promise<T>,
  { label, maxAttempts = 5, baseDelayMs = 5000, signal }: RetryOptions,
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (signal?.aborted || !isRetryable(error)) throw error;

      if (attempt >= maxAttempts) {
        throw new ApiError(
          isNetworkError(error)
            ? "Could not reach the AI service. Check your internet connection and try again"
            : "The AI service is busy right now. Please try again in a minute",
          503,
        );
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `[${label}] request failed (${getStatus(error) ?? getNetworkCode(error) ?? "unknown"}), retrying in ${delayMs / 1000}s (attempt ${attempt}/${maxAttempts})`,
      );
      await sleep(delayMs, undefined, { signal });
    }
  }
};
