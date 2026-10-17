import { z } from "zod";

const objectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid document id");

export const createChatSchema = z.object({
  documentIds: z
    .array(objectIdString, { error: "documentIds must be an array" })
    .min(1, "Select at least one document")
    .max(5, "You can chat with at most 5 documents at once"),
});

export const sendMessageSchema = z.object({
  content: z
    .string({ error: "Message is required" })
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message must be at most 2000 characters"),
});

export type CreateChatInput = z.infer<typeof createChatSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
