require("dotenv").config();
const axios = require("axios");
const { initializeVectorStore } = require("../lib/vectorStore");

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Input validation function
function validateInput(body) {
  if (!body || typeof body !== "object") {
    return { isValid: false, error: "Invalid request body" };
  }

  if (!body.question || typeof body.question !== "string") {
    return {
      isValid: false,
      error: "Question is required and must be a string",
    };
  }

  if (body.question.trim().length === 0) {
    return { isValid: false, error: "Question cannot be empty" };
  }

  if (body.question.length > 1000) {
    return {
      isValid: false,
      error: "Question is too long (max 1000 characters)",
    };
  }

  return { isValid: true };
}

// Rate limiting helper (simple in-memory implementation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];

  // Remove old requests outside the window
  const validRequests = userRequests.filter(
    (time) => now - time < RATE_LIMIT_WINDOW
  );

  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - validRequests.length,
  };
}

module.exports = async (req, res) => {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Only POST requests are accepted",
    });
  }

  try {
    // Rate limiting
    const clientIP =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "unknown";
    const rateLimit = checkRateLimit(clientIP);

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
      });
    }

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS);
    res.setHeader("X-RateLimit-Remaining", rateLimit.remaining);

    // Validate input
    const validation = validateInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: "Invalid input",
        message: validation.error,
      });
    }

    const { question } = req.body;

    // Check for required environment variables
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.error("HUGGINGFACE_API_KEY is not set");
      return res.status(500).json({
        error: "Server configuration error",
        message: "Missing required API configuration",
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY is not set");
      return res.status(500).json({
        error: "Server configuration error",
        message: "Missing required API configuration",
      });
    }

    // Initialize vector store
    console.log("Initializing vector store...");
    const vectorStore = await initializeVectorStore();

    // Perform similarity search
    console.log(
      "Performing similarity search for:",
      question.substring(0, 100) + "..."
    );
    const relevantDocs = await vectorStore.similaritySearch(question, 4);

    if (!relevantDocs || relevantDocs.length === 0) {
      return res.status(404).json({
        error: "No relevant information found",
        message:
          "I couldn't find any relevant information to answer your question.",
      });
    }

    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

    // Call AI model with retry logic
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`Calling AI model (attempt ${retryCount + 1})...`);

        const deepSeekResponse = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: "deepseek/deepseek-r1-0528:free",
            messages: [
              {
                role: "system",
                content:
                  "You are an AI assistant knowledgeable about the company. Provide accurate, helpful, and concise answers based only on the provided context. If the context doesn't contain enough information to answer the question, say so clearly.",
              },
              {
                role: "user",
                content: `Answer the following question using this context:\n\n${context}\n\nQuestion: ${question}`,
              },
            ],
            max_tokens: 1000,
            temperature: 0.7,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://your-domain.vercel.app", // Replace with your actual domain
              "X-Title": "Skyline Chat Bot",
            },
            timeout: 25000, // 25 second timeout
          }
        );

        if (!deepSeekResponse.data?.choices?.[0]?.message?.content) {
          throw new Error("Invalid response from AI model");
        }

        const reply = deepSeekResponse.data.choices[0].message.content;

        // Successful response
        return res.status(200).json({
          answer: reply,
          metadata: {
            model: "deepseek/deepseek-r1-0528:free",
            documentsFound: relevantDocs.length,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (aiError) {
        retryCount++;
        console.error(
          `AI API error (attempt ${retryCount}):`,
          aiError.response?.data || aiError.message
        );

        if (retryCount >= maxRetries) {
          // Check if it's a quota/billing issue
          if (aiError.response?.status === 429) {
            return res.status(429).json({
              error: "AI service rate limit",
              message:
                "The AI service is currently rate limited. Please try again later.",
            });
          }

          if (aiError.response?.status === 402) {
            return res.status(503).json({
              error: "AI service unavailable",
              message:
                "The AI service is temporarily unavailable. Please try again later.",
            });
          }

          return res.status(500).json({
            error: "AI processing failed",
            message: "Failed to generate response after multiple attempts.",
          });
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retryCount) * 1000)
        );
      }
    }
  } catch (error) {
    console.error("Unexpected error in ask API:", error);

    // Don't expose internal errors to clients
    return res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred. Please try again later.",
      timestamp: new Date().toISOString(),
    });
  }
};
