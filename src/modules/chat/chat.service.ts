import type { Types } from "mongoose";
import { streamAnswer, type ChatTurn } from "../../services/llm.service.js";
import { env } from "../../config/env.js";
import ApiError from "../../utils/ApiError.js";
import { toObjectId } from "../../utils/objectId.js";
import DocumentModel from "../document/document.model.js";
import Chat, { type IChat } from "./chat.model.js";
import Message, {
  type ICitation,
  type IMessage,
} from "../message/message.model.js";
import {
  NO_RESULT_MESSAGE,
  SYSTEM_INSTRUCTION,
  buildPrompt,
  extractCitations,
  retrieveChunks,
  type RetrievedChunk,
} from "./rag.service.js";

type ChatRecord = IChat & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

type MessageRecord = IMessage & { _id: Types.ObjectId; createdAt?: Date };

export interface ChatResponse {
  id: string;
  title: string;
  documentIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CitationResponse {
  index: number;
  docId: string;
  chunkId: string;
  page: number;
}

export interface MessageResponse {
  id: string;
  role: IMessage["role"];
  content: string;
  citations: CitationResponse[];
  createdAt?: Date;
}

const toCitationResponse = (citation: ICitation): CitationResponse => ({
  index: citation.index,
  docId: citation.docId.toString(),
  chunkId: citation.chunkId.toString(),
  page: citation.page,
});

const toChatResponse = (chat: ChatRecord): ChatResponse => ({
  id: chat._id.toString(),
  title: chat.title,
  documentIds: chat.docIds.map((id) => id.toString()),
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
});

const toMessageResponse = (message: MessageRecord): MessageResponse => ({
  id: message._id.toString(),
  role: message.role,
  content: message.content,
  citations: message.citations.map(toCitationResponse),
  createdAt: message.createdAt,
});

// Scoped to the owner; someone else's chat looks the same as a missing one
export const findOwnedChat = async (userId: string, chatId: string) => {
  const chat = await Chat.findOne({
    _id: toObjectId(chatId, "chat id"),
    userId: toObjectId(userId, "user id"),
  });

  if (!chat) {
    throw new ApiError("Chat not found", 404);
  }

  return chat;
};

export const createChat = async (
  userId: string,
  documentIds: string[],
): Promise<ChatResponse> => {
  const uniqueIds = [...new Set(documentIds)].map((id) =>
    toObjectId(id, "document id"),
  );

  const documents = await DocumentModel.find({
    _id: { $in: uniqueIds },
    userId: toObjectId(userId, "user id"),
  }).lean();

  if (documents.length !== uniqueIds.length) {
    throw new ApiError("Document not found", 404);
  }

  const notReady = documents.find((document) => document.status !== "ready");
  if (notReady) {
    throw new ApiError(
      notReady.status === "processing"
        ? `"${notReady.title}" is still being processed. Try again in a moment`
        : `"${notReady.title}" failed to process and can't be used for chat`,
      409,
    );
  }

  const [first] = documents;
  const title =
    documents.length === 1
      ? first!.title
      : `${first!.title} + ${documents.length - 1} more`;

  const chat = await Chat.create({
    userId: toObjectId(userId, "user id"),
    docIds: uniqueIds,
    title,
  });

  return toChatResponse(chat);
};

export const listChats = async (userId: string): Promise<ChatResponse[]> => {
  const chats = await Chat.find({ userId: toObjectId(userId, "user id") })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean<ChatRecord[]>();

  return chats.map(toChatResponse);
};

export const getChatWithMessages = async (userId: string, chatId: string) => {
  const chat = await findOwnedChat(userId, chatId);

  const messages = await Message.find({ chatId: chat._id })
    .sort({ createdAt: 1, _id: 1 })
    .limit(200)
    .lean<MessageRecord[]>();

  return {
    chat: toChatResponse(chat),
    messages: messages.map(toMessageResponse),
  };
};

export const deleteChat = async (
  userId: string,
  chatId: string,
): Promise<void> => {
  const chat = await findOwnedChat(userId, chatId);

  await Message.deleteMany({ chatId: chat._id });
  await chat.deleteOne();
};

// ---------------------------------------------------------------------------
// Answering a question
// ---------------------------------------------------------------------------

export interface PreparedReply {
  chat: Awaited<ReturnType<typeof findOwnedChat>>;
  question: string;
  history: ChatTurn[];
  chunks: RetrievedChunk[];
}

export type ReplyEvent =
  | { type: "token"; data: { text: string } }
  | {
      type: "done";
      data: { messageId: string; citations: CitationResponse[] };
    };

// Everything that can fail with a normal JSON error happens here, BEFORE the
// SSE stream is opened (bad id, not your chat, embedding or search failure).
export const prepareReply = async (
  userId: string,
  chatId: string,
  question: string,
): Promise<PreparedReply> => {
  const chat = await findOwnedChat(userId, chatId);

  const previousMessages = await Message.find({ chatId: chat._id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(env.CHAT_HISTORY_MESSAGES)
    .lean<MessageRecord[]>();

  const history: ChatTurn[] = previousMessages.reverse().map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    text: message.content,
  }));

  const chunks = await retrieveChunks(
    toObjectId(userId, "user id"),
    chat.docIds,
    question,
  );

  if (chunks.length === 0) {
    console.warn(
      `[rag] no chunks found for chat ${chatId}. If this happens for every question, check that the Atlas vector index is Active and uses the same dimensions as EMBEDDING_DIMENSIONS`,
    );
  }

  return { chat, question, history, chunks };
};

// Streams the answer, then saves the question and answer together. Nothing is
// saved if generation fails or the client disconnects, so a retry is clean.
export async function* streamReply(
  { chat, question, history, chunks }: PreparedReply,
  signal: AbortSignal,
): AsyncGenerator<ReplyEvent> {
  let answer = "";

  if (chunks.length === 0) {
    answer = NO_RESULT_MESSAGE;
    yield { type: "token", data: { text: answer } };
  } else {
    const stream = streamAnswer({
      systemInstruction: SYSTEM_INSTRUCTION,
      history,
      prompt: buildPrompt(question, chunks),
      signal,
    });

    for await (const text of stream) {
      answer += text;
      yield { type: "token", data: { text } };
    }
  }

  if (signal.aborted) return;

  if (!answer.trim()) {
    throw new ApiError(
      "The AI returned an empty answer. Please try again",
      502,
    );
  }

  const citations = chunks.length > 0 ? extractCitations(answer, chunks) : [];

  const [, assistantMessage] = await Message.insertMany([
    { chatId: chat._id, role: "user", content: question, citations: [] },
    { chatId: chat._id, role: "assistant", content: answer, citations },
  ]);

  // Moves this chat to the top of the user's chat list
  await Chat.updateOne({ _id: chat._id }, { $set: { updatedAt: new Date() } });

  yield {
    type: "done",
    data: {
      messageId: assistantMessage!._id.toString(),
      citations: citations.map(toCitationResponse),
    },
  };
}
