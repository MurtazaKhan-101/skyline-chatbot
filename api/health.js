const fs = require("fs");
const path = require("path");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

module.exports = async (req, res) => {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Only GET requests are accepted",
    });
  }

  try {
    // Check if PDF file exists
    const pdfPath = path.join(process.cwd(), "company_profile.pdf");
    const pdfExists = fs.existsSync(pdfPath);

    // Check environment variables
    const hasHuggingFaceKey = !!process.env.HUGGINGFACE_API_KEY;
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;

    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      checks: {
        pdfFile: pdfExists ? "OK" : "MISSING",
        huggingfaceKey: hasHuggingFaceKey ? "OK" : "MISSING",
        openrouterKey: hasOpenRouterKey ? "OK" : "MISSING",
      },
      endpoints: {
        ask: "/api/ask",
        health: "/api/health",
      },
    };

    // Overall health status
    const allChecksOk = Object.values(health.checks).every(
      (check) => check === "OK"
    );

    if (!allChecksOk) {
      health.status = "degraded";
      return res.status(503).json(health);
    }

    return res.status(200).json(health);
  } catch (error) {
    console.error("Health check error:", error);
    return res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
    });
  }
};
