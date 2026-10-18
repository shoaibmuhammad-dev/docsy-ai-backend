// One-off diagnostic: finds out why vector search returns no chunks.
// Usage:  npx tsx src/scripts/debug-rag.ts <chatId> ["a question"]
import "dotenv/config";
import mongoose, { Types, type PipelineStage } from "mongoose";
import { env } from "../config/env.js";
import Chat from "../modules/chat/chat.model.js";
import Chunk from "../modules/chunk/chunk.model.js";
import DocumentModel from "../modules/document/document.model.js";
import { embedQuery } from "../services/embed.service.js";

const chatId = process.argv[2];
const question =
  process.argv[3] ?? "Which companies has this person worked at?";

if (!chatId) {
  console.error(
    'Usage: npx tsx src/scripts/debug-rag.ts <chatId> ["question"]',
  );
  process.exit(1);
}

const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGO_URI is not set");

await mongoose.connect(mongoUri);

try {
  console.log("\n=== 1. Where am I connected? ===");
  console.log("database:  ", mongoose.connection.name);
  console.log("collection:", Chunk.collection.name);

  console.log("\n=== 2. Search indexes on this collection ===");
  const indexes = (await Chunk.collection.listSearchIndexes().toArray()) as {
    name: string;
    type?: string;
    status?: string;
    queryable?: boolean;
    latestDefinition?: unknown;
  }[];
  if (indexes.length === 0) {
    console.log(
      "NONE. The index is missing, or it was created on a different database/collection.",
    );
  }
  for (const index of indexes) {
    console.log({
      name: index.name,
      type: index.type,
      status: index.status,
      queryable: index.queryable,
      definition: JSON.stringify(index.latestDefinition),
    });
  }

  console.log("\n=== 3. The chat and its documents ===");
  const chat = await Chat.findById(chatId).lean();
  if (!chat) throw new Error("Chat not found");
  console.log("chat.userId:", String(chat.userId));

  for (const docId of chat.docIds) {
    const document = await DocumentModel.findById(docId).lean();
    const chunkCount = await Chunk.countDocuments({ docId });
    console.log(
      `document ${docId}: status=${document?.status ?? "MISSING"}, chunks=${chunkCount}`,
    );
  }

  console.log("\n=== 4. A sample stored chunk ===");
  const sample = await Chunk.findOne({ docId: { $in: chat.docIds } })
    .select("+embedding")
    .lean();
  if (!sample) {
    console.log(
      "NO CHUNKS for this chat's documents. The chat points at a document without chunks.",
    );
  } else {
    console.log({
      page: sample.page,
      embeddingLength: sample.embedding.length,
      userIdMatchesChat: String(sample.userId) === String(chat.userId),
      userIdIsObjectId: sample.userId instanceof Types.ObjectId,
      docIdIsObjectId: sample.docId instanceof Types.ObjectId,
    });
  }

  console.log("\n=== 5. Vector search, with and without filters ===");
  const queryVector = await embedQuery(question);
  console.log(
    "query vector length:",
    queryVector.length,
    "| EMBEDDING_DIMENSIONS:",
    env.EMBEDDING_DIMENSIONS,
  );

  const search = async (label: string, filter?: object) => {
    const pipeline = [
      {
        $vectorSearch: {
          index: "chunks_vector_index",
          path: "embedding",
          queryVector,
          numCandidates: 100,
          limit: 6,
          ...(filter ? { filter } : {}),
        },
      },
      { $project: { page: 1, score: { $meta: "vectorSearchScore" } } },
    ] as unknown as PipelineStage[];

    try {
      const results = await Chunk.aggregate<{ page: number; score: number }>(
        pipeline,
      );
      console.log(
        label.padEnd(24),
        `${results.length} results`,
        results.map((r) => `p${r.page}:${r.score.toFixed(3)}`).join(" "),
      );
    } catch (error) {
      console.log(label.padEnd(24), "ERROR:", (error as Error).message);
    }
  };

  await search("no filter");
  await search("docId filter only", { docId: { $in: chat.docIds } });
  await search("userId + docId filter", {
    $and: [{ userId: { $eq: chat.userId } }, { docId: { $in: chat.docIds } }],
  });
} finally {
  await mongoose.disconnect();
}
