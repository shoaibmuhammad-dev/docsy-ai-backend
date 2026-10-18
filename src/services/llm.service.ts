import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { withRetry } from "../utils/retry.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

interface StreamAnswerOptions {
  systemInstruction: string;
  history: ChatTurn[];
  prompt: string;
  signal?: AbortSignal;
}

// Yields the answer text piece by piece as Gemini generates it
export async function* streamAnswer({
  systemInstruction,
  history,
  prompt,
  signal,
}: StreamAnswerOptions): AsyncGenerator<string> {
  // Only the initial request is retried (connection drops, 429s). Short delays
  // because a person is waiting. Errors in the middle of a stream are not retried.
  const stream = await withRetry(
    () =>
      ai.models.generateContentStream({
        model: env.GEMINI_CHAT_MODEL,
        contents: [
          ...history.map((turn) => ({
            role: turn.role,
            parts: [{ text: turn.text }],
          })),
          { role: "user", parts: [{ text: prompt }] },
        ],
        config: { systemInstruction, abortSignal: signal },
      }),
    { label: "chat", maxAttempts: 3, baseDelayMs: 2000, signal },
  );

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}
