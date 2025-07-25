require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const {
  HuggingFaceInferenceEmbeddings,
} = require("@langchain/community/embeddings/hf");

const app = express();
app.use(express.json());
app.use(express.static("public"));

let vectorStore;

// Load and embed data
async function loadDocsAndEmbed() {
  const dataBuffer = fs.readFileSync("./company_profile.pdf");
  const pdfData = await pdfParse(dataBuffer);
  const text = pdfData.text;

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 100,
  });
  const docs = await splitter.createDocuments([text]);

  const embedder = new HuggingFaceInferenceEmbeddings({
    model: "sentence-transformers/all-MiniLM-L6-v2",
    apiKey: process.env.HUGGINGFACE_API_KEY,
  });

  vectorStore = await MemoryVectorStore.fromDocuments(docs, embedder);
}

app.post("/ask", async (req, res) => {
  const userQuestion = req.body.question;

  const relevantDocs = await vectorStore.similaritySearch(userQuestion, 4);
  const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

  try {
    const deepSeek = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-r1-0528:free",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant knowledgeable about the company.",
          },
          {
            role: "user",
            content: `Answer the following question using this context:\n\n${context}\n\nQuestion: ${userQuestion}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = deepSeek.data.choices[0].message.content;
    res.json({ answer: reply });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to get answer from DeepSeek." });
  }
});

// Initialize and start server
loadDocsAndEmbed().then(() => {
  app.listen(3000, () =>
    console.log("RAG server running on http://localhost:3000")
  );
});
