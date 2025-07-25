# Company RAG Chat Bot API

A robust RAG (Retrieval-Augmented Generation) powered chat bot API that allows users to ask questions about company information stored in a PDF document.

## Features

- 🚀 **Serverless deployment** on Vercel
- 🔍 **Semantic search** using HuggingFace embeddings
- 🤖 **AI-powered responses** via DeepSeek model
- ⚡ **Fast similarity search** with vector embeddings
- 🛡️ **Rate limiting** and input validation
- 🌐 **CORS enabled** for cross-origin requests
- 📊 **Health check endpoint** for monitoring

## API Endpoints

### POST `/api/ask`

Ask questions about the company information.

**Request Body:**

```json
{
  "question": "What is the company's mission?"
}
```

**Response:**

```json
{
  "answer": "The company's mission is...",
  "metadata": {
    "model": "deepseek/deepseek-r1-0528:free",
    "documentsFound": 4,
    "timestamp": "2025-01-XX..."
  }
}
```

### GET `/api/health`

Check the health status of the API.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX...",
  "version": "1.0.0",
  "checks": {
    "pdfFile": "OK",
    "huggingfaceKey": "OK",
    "openrouterKey": "OK"
  }
}
```

## Deployment Instructions

### 1. Prerequisites

- Vercel account
- HuggingFace API key
- OpenRouter API key
- Company PDF document

### 2. Environment Variables

Create these environment variables in your Vercel project:

```env
HUGGINGFACE_API_KEY=your_huggingface_token_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### 3. Deploy to Vercel

#### Option A: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

#### Option B: GitHub Integration

1. Push your code to GitHub
2. Import the repository in Vercel dashboard
3. Set environment variables
4. Deploy

### 4. Upload PDF Document

Ensure `company_profile.pdf` is in the project root directory before deployment.

## Local Development

1. **Install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**
   Create a `.env` file with your API keys.

3. **Run locally:**

```bash
# For Vercel dev environment
npm run dev

# Or traditional Express server
npm start
```

4. **Test the API:**

```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What does the company do?"}'
```

## Rate Limits

- 10 requests per minute per IP address
- 1000 character limit per question
- 30-second timeout for AI responses

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid input)
- `404` - No relevant information found
- `429` - Rate limit exceeded
- `500` - Internal server error
- `503` - Service unavailable

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │    │   Vercel API     │    │  External APIs  │
│                 │    │                  │    │                 │
│  Web/Mobile     │───▶│  /api/ask       │───▶│  HuggingFace    │
│  Application    │    │  /api/health    │    │  OpenRouter     │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Vector Store   │
                       │  (In Memory)     │
                       │                  │
                       │  PDF Content     │
                       │  Embeddings      │
                       └──────────────────┘
```

## Security Features

- Input validation and sanitization
- Rate limiting per IP
- CORS configuration
- Environment variable protection
- Error message sanitization

## Monitoring

Use the `/api/health` endpoint to monitor:

- API availability
- PDF file presence
- API key configuration
- Service dependencies

## Troubleshooting

### Common Issues:

1. **PDF not found**: Ensure `company_profile.pdf` is in the root directory
2. **API key errors**: Check environment variables are set correctly
3. **Rate limiting**: Wait 1 minute between burst requests
4. **Timeout errors**: Questions that require extensive context may timeout

### Support

For issues, check the Vercel function logs in your dashboard.
