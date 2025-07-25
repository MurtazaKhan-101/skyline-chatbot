const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const {
  HuggingFaceInferenceEmbeddings,
} = require("@langchain/community/embeddings/hf");

let vectorStore = null;
let isInitialized = false;

async function initializeVectorStore() {
  if (isInitialized && vectorStore) {
    return vectorStore;
  }

  try {
    // Read PDF file from the root directory
    const pdfPath = path.join(process.cwd(), "company_profile.pdf");

    if (!fs.existsSync(pdfPath)) {
      throw new Error("company_profile.pdf not found in project root");
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    if (!text || text.trim().length === 0) {
      throw new Error("No text content found in PDF");
    }

    // Split text into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
    });
    const docs = await splitter.createDocuments([text]);

    if (docs.length === 0) {
      throw new Error("No documents created from text splitting");
    }

    // Create embeddings
    const embedder = new HuggingFaceInferenceEmbeddings({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      apiKey: process.env.HUGGINGFACE_API_KEY,
    });

    // Create vector store
    vectorStore = await MemoryVectorStore.fromDocuments(docs, embedder);
    isInitialized = true;

    console.log(`Vector store initialized with ${docs.length} documents`);
    return vectorStore;
  } catch (error) {
    console.error("Error initializing vector store:", error);
    throw error;
  }
}

module.exports = { initializeVectorStore };
