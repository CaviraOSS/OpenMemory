# Chat Interface Setup

The chat interface is now connected to the OpenMemory backend and can query memories in real-time.

## Features

✅ **Memory Querying**: Searches your memory database for relevant content
✅ **Salience-based Results**: Shows top memories ranked by relevance
✅ **Memory Reinforcement**: Click the + button to boost memory importance
✅ **Real-time Updates**: Live connection to backend API
✅ **Action Buttons**: Quick actions after assistant responses

## Setup Instructions

### 1. Start the Backend

First, make sure the OpenMemory backend is running:

```bash
cd backend
npm install
npm run dev
```

The backend will start on `http://localhost:8080`

### 2. Configure Environment (Optional)

The dashboard is pre-configured to connect to `localhost:8080`. If your backend runs on a different port, create a `.env.local` file:

```bash
# dashboard/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 3. Start the Dashboard

```bash
cd dashboard
npm install
npm run dev
```

The dashboard will start on `http://localhost:3000`

### 4. Add Some Memories

Before chatting, you need to add some memories to your database. You can do this via:

**Option A: API (Recommended for Testing)**

```bash
curl -X POST http://localhost:8080/memory/add \
  -H "Content-Type: application/json" \
  -d '{
    "content": "JavaScript async/await makes asynchronous code more readable",
    "tags": ["javascript", "async"],
    "metadata": {"source": "learning"}
  }'
```

**Option B: Use the SDK**

```javascript
// examples/js-sdk/basic-usage.js
import OpenMemory from '../../sdk-js/src/index.js';

const om = new OpenMemory('http://localhost:8080');

await om.addMemory({
  content: 'React hooks revolutionized state management',
  tags: ['react', 'hooks'],
});
```

**Option C: Ingest a Document**

```bash
curl -X POST http://localhost:8080/memory/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "text",
    "data": "Your document content here...",
    "metadata": {"source": "document"}
  }'
```

## How It Works

### Memory Query Flow

1. **User Input**: You ask a question in the chat
2. **Backend Query**: POST to `/memory/query` with your question
3. **Vector Search**: Backend searches HSG memory graph
4. **Results**: Top 5 memories returned with salience scores
5. **Response**: Chat generates answer based on retrieved memories

### Memory Reinforcement

Clicking the **+** button on a memory card:

- Sends POST to `/memory/reinforce`
- Increases memory salience by 0.1
- Makes it more likely to appear in future queries

## Current Features

✅ Real-time memory querying
✅ Salience-based ranking
✅ Memory reinforcement (boost)
✅ Sector classification display
✅ Error handling with backend status

## Coming Soon

- 🚧 LLM Integration (OpenAI, Ollama, Gemini)
- 🚧 Conversation memory persistence
- 🚧 Export chat to memories
- 🚧 WebSocket streaming responses
- 🚧 Quiz generation from memories
- 🚧 Podcast script generation

## Troubleshooting

### "Failed to query memories"

- Ensure backend is running: `npm run dev` in `backend/`
- Check backend is on port 8080: `curl http://localhost:8080/health`
- Verify CORS is enabled (already configured)

### "No memories found"

- Add memories using the API or SDK (see setup above)
- Try broader search terms
- Check memory content exists: `GET http://localhost:8080/memory/all`

### Connection refused

- Backend not started
- Wrong port in `.env.local`
- Firewall blocking connection

## API Endpoints Used

```typescript
POST /memory/query      // Search memories
POST /memory/add        // Add new memory
POST /memory/reinforce  // Boost memory salience
GET  /memory/all        // List all memories
GET  /memory/:id        // Get specific memory
```

## Next Steps

1. Add LLM integration for intelligent responses
2. Implement conversation memory storage
3. Add streaming response support
4. Create memory export feature
5. Build quiz/podcast generators
