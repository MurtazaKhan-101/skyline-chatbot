// Example usage for web applications
const API_BASE_URL = "https://your-project.vercel.app";

// Function to ask questions to the chat bot
async function askChatBot(question) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "API request failed");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error asking chat bot:", error);
    throw error;
  }
}

// Function to check API health
async function checkAPIHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    const healthData = await response.json();
    return healthData;
  } catch (error) {
    console.error("Error checking API health:", error);
    return { status: "error", error: error.message };
  }
}

// Example usage
async function exampleUsage() {
  try {
    // Check if API is healthy
    const health = await checkAPIHealth();
    console.log("API Health:", health);

    if (health.status !== "healthy") {
      console.warn("API is not fully healthy");
    }

    // Ask a question
    const result = await askChatBot("What does the company do?");
    console.log("Bot Response:", result.answer);
    console.log("Metadata:", result.metadata);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// React Hook Example
function useChatBot() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const askQuestion = async (question) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await askChatBot(question);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { askQuestion, isLoading, error };
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = { askChatBot, checkAPIHealth };
}
