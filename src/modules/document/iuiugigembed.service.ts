import { setTimeout as sleep } from "node:timers/promises";
import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import ApiError from "../../utils/ApiError.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

type EmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const CHARS_PER_TOKEN = 4; // rough estimate, good enough for pacing

const isRetryable = (error: unknown): boolean => {
  const status = (error as { status?: number }).status;
  return status === 429 || status === 500 || status === 503;
};

// Retries rate-limit / temporary errors with a growing delay (5s, 10s, 20s...)
const embedBatch = async (
  texts: string[],
  taskType: EmbeddingTask,
): Promise<number[][]> => {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: env.EMBEDDING_MODEL,
        contents: texts,
        config: {
          taskType,
          outputDimensionality: env.EMBEDDING_DIMENSIONS,
        },
      });

      const vectors = (response.embeddings ?? []).map((item) => item.values);

      if (
        vectors.length !== texts.length ||
        vectors.some((values) => !values || values.length === 0)
      ) {
        throw new Error("Embedding API returned an unexpected response");
      }

      return vectors as number[][];
    } catch (error) {
      if (!isRetryable(error)) throw error;

      if (attempt >= MAX_ATTEMPTS) {
        throw new ApiError(
          "The AI service is busy right now. Please try again in a minute",
          503,
        );
      }

      const delayMs = 5000 * 2 ** (attempt - 1);
      console.warn(
        `[embed] rate limited or unavailable, retrying in ${delayMs / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})`,
      );
      await sleep(delayMs);
    }
  }
};

export const embedTexts = async (
  texts: string[],
  taskType: EmbeddingTask = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> => {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const startedAt = Date.now();

    embeddings.push(...(await embedBatch(batch, taskType)));

    // Stay under the free tier's tokens-per-minute limit by spacing batches out
    const isLastBatch = i + BATCH_SIZE >= texts.length;
    if (env.EMBEDDING_TOKENS_PER_MINUTE > 0 && !isLastBatch) {
      const estimatedTokens =
        batch.reduce((sum, text) => sum + text.length, 0) / CHARS_PER_TOKEN;
      const minimumDurationMs =
        (estimatedTokens / env.EMBEDDING_TOKENS_PER_MINUTE) * 60_000;
      const waitMs = minimumDurationMs - (Date.now() - startedAt);

      if (waitMs > 0) await sleep(waitMs);
    }
  }

  return embeddings;
};

// Used by the chat step to embed the user's question
export const embedQuery = async (text: string): Promise<number[]> => {
  const [embedding] = await embedTexts([text], "RETRIEVAL_QUERY");

  if (!embedding) {
    throw new Error("Embedding API returned no result");
  }

  return embedding;
};
