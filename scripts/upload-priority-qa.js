require("dotenv").config({ path: ".env" });

const fs = require("fs");
const { Pinecone } = require("@pinecone-database/pinecone");
const { OpenAI } = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getEmbedding(text) {
  const resp = await client.embeddings.create({
    model: "text-embedding-3-small", // you can also use text-embedding-3-large if needed
    input: text,
  });
  return resp.data[0].embedding;
}

async function uploadPriorityQA() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/upload-priority-qa.js <tsv-file-path>");
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    const headers = lines[0].split("\t").map(h => h.trim().toLowerCase());

    console.log(`Reading ${lines.length - 1} rows from ${filePath}`);

    const vectors = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split("\t");
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });

      // Combine question variants
      const q = [row["question_main"], row["question_var1"], row["question_var2"], row["question_var3"]]
        .filter(Boolean)
        .join(" ");
      const a = row["answer"] || "";
      const c = row["category"] || "";

      if (q.trim()) {
        const vector = await getEmbedding(q.trim());

        vectors.push({
          id: row["id"] ? `priority-qa-${row["id"]}` : `priority-qa-${i}`,
          values: vector,
          metadata: {
            question: q.trim(),
            answer: a,
            category: c,
            priority: "high",
          },
        });
      }
    }

    console.log(`Uploading ${vectors.length} vectors to Pinecone namespace "priority-qa"...`);

    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index(process.env.PINECONE_INDEX || "rabbitloader-kb");

    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.namespace("priority-qa").upsert(batch);
      console.log(
        `Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`
      );
    }

    console.log("✅ Upload completed successfully!");
  } catch (error) {
    console.error("❌ Error uploading priority QA:", error);
    process.exit(1);
  }
}

uploadPriorityQA();
