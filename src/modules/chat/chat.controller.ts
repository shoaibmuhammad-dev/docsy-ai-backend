import type { Request, Response } from "express";
import ApiError from "../../utils/ApiError.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { sendSseEvent, startSse } from "../../utils/sse.js";
import type {
  CreateChatInput,
  SendMessageInput,
} from "../../validators/chat.validator.js";
import * as chatService from "./chat.service.js";

// Adjust this one function if your authMiddleware stores the user differently
const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError("Unauthorized", 401);
  }
  return userId;
};

export const createChat = asyncHandler(async (req: Request, res: Response) => {
  const { documentIds } = req.body as CreateChatInput;
  const chat = await chatService.createChat(getUserId(req), documentIds);

  res.status(201).json({ success: true, data: { chat } });
});

export const getChats = asyncHandler(async (req: Request, res: Response) => {
  const chats = await chatService.listChats(getUserId(req));

  res.status(200).json({ success: true, data: { chats } });
});

export const getChat = asyncHandler(async (req: Request, res: Response) => {
  const result = await chatService.getChatWithMessages(
    getUserId(req),
    String(req.params.id),
  );

  res.status(200).json({ success: true, data: result });
});

export const deleteChat = asyncHandler(async (req: Request, res: Response) => {
  await chatService.deleteChat(getUserId(req), String(req.params.id));

  res.status(200).json({ success: true, message: "Chat deleted successfully" });
});

const toClientMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;

  const status = (error as { status?: number }).status;
  if (status === 429) {
    return "The AI service is busy (free-tier limit). Please try again in a minute";
  }

  return "Something went wrong while generating the answer";
};

// POST /api/chats/:id/messages  ->  Server-Sent Events stream
//   event: token  data: {"text": "..."}
//   event: done   data: {"messageId": "...", "citations": [...]}
//   event: error  data: {"message": "..."}
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { content } = req.body as SendMessageInput;

  // Errors here are returned as normal JSON responses
  const prepared = await chatService.prepareReply(
    getUserId(req),
    String(req.params.id),
    content,
  );

  startSse(res);

  // Stop generating (and spending free-tier quota) if the client goes away
  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    for await (const event of chatService.streamReply(
      prepared,
      abortController.signal,
    )) {
      sendSseEvent(res, event.type, event.data);
    }
  } catch (error) {
    if (!abortController.signal.aborted) {
      console.error("[chat] reply failed:", error);
      sendSseEvent(res, "error", { message: toClientMessage(error) });
    }
  } finally {
    res.end();
  }
});
