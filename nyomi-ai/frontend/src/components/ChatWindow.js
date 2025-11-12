import React, { useState, useEffect } from 'react';
import MessageList from './MessageList';
import InputBox from './InputBox';
import './ChatWindow.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ChatWindow({ conversation, onUpdateConversation, darkMode }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (conversation) {
      setMessages(conversation.messages || []);
    }
  }, [conversation]);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    onUpdateConversation(conversation.id, newMessages);
    setIsLoading(true);
    setError(null);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text.trim(),
          conversationHistory
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        text: data.reply,
        sender: 'ai',
        timestamp: new Date().toISOString()
      };

      const updatedMessages = [...newMessages, aiMessage];
      setMessages(updatedMessages);
      onUpdateConversation(conversation.id, updatedMessages);
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message. Please try again.');
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: `Sorry, I encountered an error: ${err.message}. Please check your API key and try again.`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        isError: true
      };

      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      onUpdateConversation(conversation.id, updatedMessages);
    } finally {
      setIsLoading(false);
    }
  };

  if (!conversation) {
    return (
      <div className="chat-window">
        <div className="empty-state">
          <h2>Welcome to Nyomi AI 🤍</h2>
          <p>Start a new conversation to begin chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h2>Nyomi AI</h2>
        <span className="status-indicator">
          {isLoading ? '● Typing...' : '● Online'}
        </span>
      </div>

      <MessageList messages={messages} isLoading={isLoading} darkMode={darkMode} />
      
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <InputBox onSendMessage={sendMessage} disabled={isLoading} />
    </div>
  );
}

export default ChatWindow;
