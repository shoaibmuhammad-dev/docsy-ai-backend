import type { Response } from "express";

// Server-Sent Events helpers. Call startSse once, then sendSseEvent per event.
export const startSse = (res: Response): void => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // stop proxies (nginx etc.) from buffering
  res.flushHeaders();
};

export const sendSseEvent = (
  res: Response,
  event: string,
  data: unknown,
): void => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};
