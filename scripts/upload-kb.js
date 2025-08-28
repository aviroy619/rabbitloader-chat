require("dotenv").config({ path: ".env" });
const fs = require("fs");
const path = process.argv[2];
const pinecone = require("../server/clients/pinecone");
const openai = require("../server/clients/openai");

if (!path) {
  console.error("Usage: node scripts/upload-kb.js <file.tsv>");
  process.exit(1);
}

(async () => {
  const lines = fs.readFileSync(path, "utf8").trim().split("\n");
  console.log(`Reading ${lines.length} rows from ${path}`);

  const vectors = [];
  for (let i = 0; i < lines.length; i++) {
    const [id, text] = lines[i].split("\t");
    if (!text) continue;

    const embedding = await openai.embed(text);
    vectors.push({
      id: id || `doc-${i}`,
      values: embedding,
      metadata: { text }
    });
  }

  console.log(`Uploading ${vectors.length} vectors to Pinecone namespace "_default_"...`);
  await pinecone.upsert("rabbitloader-kb", "_default_", vectors);
  console.log("✅ Upload complete.");
})();
