// One-off: creates the Atlas Vector Search index on the database this app
// actually uses, then waits until it is ready.
// Usage:  npx tsx src/scripts/create-vector-index.ts
import "dotenv/config";
import { setTimeout as sleep } from "node:timers/promises";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import Chunk from "../modules/chunk/chunk.model.js";

const INDEX_NAME = "chunks_vector_index";

interface SearchIndexInfo {
  name: string;
  status?: string;
  queryable?: boolean;
}

const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGO_URI is not set");

await mongoose.connect(mongoUri);

try {
  console.log(
    `Database: ${mongoose.connection.name} | Collection: ${Chunk.collection.name}`,
  );

  try {
    await Chunk.createCollection(); // the collection must exist before an index can be created
  } catch (error) {
    if ((error as { code?: number }).code !== 48) throw error; // 48 = already exists
  }

  const existing = (await Chunk.collection
    .listSearchIndexes()
    .toArray()) as SearchIndexInfo[];

  if (existing.some((index) => index.name === INDEX_NAME)) {
    console.log(`Index "${INDEX_NAME}" already exists on this collection.`);
  } else {
    await Chunk.collection.createSearchIndex({
      name: INDEX_NAME,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: env.EMBEDDING_DIMENSIONS,
            similarity: "cosine",
          },
          { type: "filter", path: "userId" },
          { type: "filter", path: "docId" },
        ],
      },
    });
    console.log(
      `Index "${INDEX_NAME}" creation started (${env.EMBEDDING_DIMENSIONS} dimensions).`,
    );
  }

  // Index builds are asynchronous: wait up to ~2 minutes for it to become queryable
  for (let attempt = 1; attempt <= 24; attempt++) {
    const [index] = (await Chunk.collection
      .listSearchIndexes(INDEX_NAME)
      .toArray()) as SearchIndexInfo[];

    console.log(
      `  status: ${index?.status ?? "unknown"} | queryable: ${index?.queryable ?? false}`,
    );

    if (index?.queryable) {
      console.log("\nThe index is ready. Ask your question again.");
      break;
    }

    await sleep(5000);
  }
} finally {
  await mongoose.disconnect();
}
