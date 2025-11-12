import React, { useEffect, useRef, useState } from 'react';
import { FiUser } from 'react-icons/fi';
import './MessageList.css';

function MessageList({ messages, isLoading, darkMode }) {
  const messagesEndRef = useRef(null);
  const [displayedText, setDisplayedText] = useState({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.sender === 'ai' && !displayedText[lastMessage.id]) {
      let index = 0;
      const text = lastMessage.text;
      const interval = setInterval(() => {
        if (index <= text.length) {
          setDisplayedText(prev => ({
            ...prev,
            [lastMessage.id]: text.substring(0, index)
          }));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 10);

      return () => clearInterval(interval);
    }
  }, [messages, displayedText]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="message-list empty">
        <div className="welcome-message">
          <div className="nyomi-logo">🤍</div>
          <h2>Hello! I'm Nyomi AI</h2>
          <p>Your smart, kind, and helpful assistant</p>
          <div className="suggestions">
            <p>Try asking me about:</p>
            <ul>
              <li>💡 Creative ideas and brainstorming</li>
              <li>📚 Learning new topics</li>
              <li>💻 Coding and technical help</li>
              <li>✍️ Writing and content creation</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${message.sender} ${message.isError ? 'error' : ''}`}
        >
          <div className="message-avatar">
            {message.sender === 'user' ? (
              <FiUser size={20} />
            ) : (
              <span className="ai-avatar">🤍</span>
            )}
          </div>
          <div className="message-content">
            <div className="message-header">
              <span className="message-sender">
                {message.sender === 'user' ? 'You' : 'Nyomi AI'}
              </span>
              <span className="message-time">{formatTime(message.timestamp)}</span>
            </div>
            <div className="message-text">
              {message.sender === 'ai' && displayedText[message.id] !== undefined
                ? displayedText[message.id]
                : message.text}
            </div>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="message ai">
          <div className="message-avatar">
            <span className="ai-avatar">🤍</span>
          </div>
          <div className="message-content">
            <div className="message-header">
              <span className="message-sender">Nyomi AI</span>
            </div>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
