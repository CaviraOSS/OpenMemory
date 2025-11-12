# Nyomi AI 🤍

A production-ready, fully intelligent chatbot that works and converses naturally like ChatGPT. Built with React and Node.js/Express, powered by OpenAI GPT-4.

![Nyomi AI](https://img.shields.io/badge/AI-Chatbot-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-orange)

## ✨ Features

### Core Functionality
- 💬 **Natural Conversations** - Chat naturally with AI powered by OpenAI GPT-4o-mini
- 📝 **Chat History** - Persistent conversation storage using localStorage
- 🎨 **Beautiful UI** - Clean, minimal design with white + blue theme
- 📱 **Fully Responsive** - Perfect on mobile and desktop devices
- ⚡ **Real-time Typing** - Animated typing effect for AI responses
- 🕐 **Timestamps** - Every message shows when it was sent

### Advanced Features
- 🎤 **Voice Input** - Speech-to-text using Web Speech API
- 🌓 **Dark Mode** - Toggle between light and dark themes
- 💾 **Auto-save** - Conversations automatically saved to localStorage
- 🔄 **Multiple Chats** - Create and manage multiple conversations
- 🗑️ **Easy Management** - Clear individual chats or all at once
- ⌨️ **Keyboard Shortcuts** - Press Enter to send, Shift+Enter for new line

## 🚀 Quick Start

### Prerequisites
- Node.js 14 or higher
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Installation

1. **Clone or download this repository**
```bash
cd nyomi-ai
```

2. **Set up the backend**
```bash
cd backend
npm install
cp .env.example .env
```

3. **Configure your OpenAI API key**

Edit `backend/.env` and add your API key:
```env
OPENAI_API_KEY=your_api_key_here
PORT=5000
```

4. **Set up the frontend**
```bash
cd ../frontend
npm install
cp .env.example .env
```

Edit `frontend/.env` if needed:
```env
REACT_APP_API_URL=http://localhost:5000
```

### Running the Application

**Option 1: Run both servers separately**

Terminal 1 (Backend):
```bash
cd backend
npm start
```

Terminal 2 (Frontend):
```bash
cd frontend
npm start
```

**Option 2: Use the provided start script**
```bash
# From the nyomi-ai root directory
npm start
```

The app will open at `http://localhost:3000`

## 📁 Project Structure

```
nyomi-ai/
├── backend/
│   ├── routes/
│   │   └── chat.js          # OpenAI API integration
│   ├── server.js             # Express server
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── public/
│   │   └── index.html        # HTML with SEO meta tags
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.js    # Chat history sidebar
│   │   │   ├── ChatWindow.js # Main chat interface
│   │   │   ├── MessageList.js # Message display
│   │   │   └── InputBox.js   # Input with voice support
│   │   ├── App.js            # Main app component
│   │   └── App.css           # Global styles
│   ├── package.json
│   └── .env.example
└── README.md
```

## 🎨 UI Features

- **Clean Design** - Minimal white + blue theme inspired by ChatGPT
- **Chat Sidebar** - View and manage conversation history
- **Message Bubbles** - Distinct styling for user and AI messages
- **Typing Animation** - Smooth character-by-character AI responses
- **Loading Indicators** - Visual feedback when AI is thinking
- **Responsive Layout** - Adapts perfectly to any screen size
- **Dark Mode** - Easy on the eyes for night-time use

## 🔧 Configuration

### Backend Configuration (`backend/.env`)
```env
OPENAI_API_KEY=your_api_key_here  # Required: Your OpenAI API key
PORT=5000                          # Optional: Server port (default: 5000)
```

### Frontend Configuration (`frontend/.env`)
```env
REACT_APP_API_URL=http://localhost:5000  # Backend API URL
```

## 🌐 Deployment

### Deploy to Vercel

**Backend:**
1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your repository
4. Set root directory to `backend`
5. Add environment variable: `OPENAI_API_KEY`
6. Deploy

**Frontend:**
1. Import the same repository again
2. Set root directory to `frontend`
3. Add environment variable: `REACT_APP_API_URL` (your backend URL)
4. Deploy

### Deploy to Render

**Backend:**
1. Create a new Web Service
2. Connect your repository
3. Set root directory to `backend`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variable: `OPENAI_API_KEY`

**Frontend:**
1. Create a new Static Site
2. Connect your repository
3. Set root directory to `frontend`
4. Build command: `npm run build`
5. Publish directory: `build`
6. Add environment variable: `REACT_APP_API_URL`

### Deploy to Replit

1. Import from GitHub
2. Set up environment variables in Secrets
3. Run `npm install` in both directories
4. Use the Run button to start

## 🧪 Testing

### Test Backend API
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, Nyomi!"}'
```

### Health Check
```bash
curl http://localhost:5000/api/health
```

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **React Icons** - Icon library
- **Web Speech API** - Voice input
- **localStorage** - Data persistence

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **OpenAI API** - GPT-4o-mini model
- **CORS** - Cross-origin support
- **dotenv** - Environment configuration

## 📝 API Endpoints

### POST `/api/chat`
Send a message to the AI and get a response.

**Request:**
```json
{
  "message": "Hello, how are you?",
  "conversationHistory": [
    {"role": "user", "content": "Previous message"},
    {"role": "assistant", "content": "Previous response"}
  ]
}
```

**Response:**
```json
{
  "reply": "I'm doing great! How can I help you today?",
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 15,
    "total_tokens": 35
  }
}
```

### GET `/api/health`
Check if the backend is running.

**Response:**
```json
{
  "status": "ok",
  "message": "Nyomi AI backend is running",
  "timestamp": "2025-11-12T10:30:00.000Z"
}
```

## 🎯 Features Breakdown

### Implemented ✅
- ✅ Clean minimal design (white + blue theme)
- ✅ ChatGPT-like interface
- ✅ Chat history sidebar
- ✅ Message timestamps
- ✅ Animated typing effect
- ✅ Auto-scroll to bottom
- ✅ Loading indicators
- ✅ Clear chat functionality
- ✅ localStorage persistence
- ✅ Voice input (Web Speech API)
- ✅ Dark mode toggle
- ✅ Responsive design
- ✅ Press Enter to send
- ✅ OpenAI GPT-4o-mini integration
- ✅ Error handling
- ✅ Multiple conversations

### Optional Enhancements (Future)
- ⏳ Voice output (Text-to-Speech)
- ⏳ Image upload and description
- ⏳ Export conversations
- ⏳ User authentication
- ⏳ Cloud storage sync

## 🐛 Troubleshooting

### Backend won't start
- Check if port 5000 is available
- Verify your OpenAI API key is correct
- Run `npm install` in the backend directory

### Frontend can't connect to backend
- Ensure backend is running on port 5000
- Check `REACT_APP_API_URL` in frontend/.env
- Verify CORS is enabled in backend

### Voice input not working
- Voice input requires HTTPS or localhost
- Check browser compatibility (Chrome/Edge recommended)
- Grant microphone permissions when prompted

### API errors
- Verify your OpenAI API key is valid
- Check your OpenAI account has credits
- Review backend console for error messages

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 💡 Tips

- **Save API costs**: The app uses GPT-4o-mini which is cost-effective
- **Conversation context**: The app sends conversation history for context
- **Dark mode**: Toggle in the sidebar for comfortable night-time use
- **Voice input**: Click the microphone icon and speak naturally
- **Keyboard shortcuts**: Use Enter to send, Shift+Enter for new lines

## 🌟 Credits

Built with ❤️ using:
- [OpenAI API](https://openai.com)
- [React](https://react.dev)
- [Express](https://expressjs.com)
- [React Icons](https://react-icons.github.io/react-icons/)

---

**Nyomi AI** - Your personal smart assistant 🤍
