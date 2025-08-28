require("dotenv").config({ path: ".env" });

const fs = require("fs");
const { Pinecone } = require("@pinecone-database/pinecone");
const { OpenAI } = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getEmbedding(text) {
  const resp = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return resp.data[0].embedding;
}

async function uploadActions() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/upload-actions.js <file.tsv>");
    process.exit(1);
  }

  const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");

  console.log(`Reading ${lines.length} rows from ${filePath}`);

  const vectors = [];
  for (let i = 0; i < lines.length; i++) {
    const [id, text] = lines[i].split("\t");
    if (!text) continue;

    const vector = await getEmbedding(text);

    vectors.push({
      id: id || `action-${i}`,
      values: vector,
      metadata: { text },
    });
  }

  console.log(`Uploading ${vectors.length} vectors to Pinecone namespace "actions"...`);

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index(process.env.PINECONE_INDEX || "rabbitloader-kb");

  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.namespace("actions").upsert(batch);
    console.log(
      `Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`
    );
  }

  console.log("✅ Upload completed successfully!");
}

uploadActions();
