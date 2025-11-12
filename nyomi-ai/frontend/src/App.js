import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedConversations = localStorage.getItem('nyomi-conversations');
    const savedDarkMode = localStorage.getItem('nyomi-darkMode');
    
    if (savedConversations) {
      const parsed = JSON.parse(savedConversations);
      setConversations(parsed);
      if (parsed.length > 0) {
        setCurrentConversationId(parsed[0].id);
      }
    } else {
      const newConversation = createNewConversation();
      setConversations([newConversation]);
      setCurrentConversationId(newConversation.id);
    }

    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('nyomi-conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('nyomi-darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const createNewConversation = () => {
    return {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString()
    };
  };

  const handleNewChat = () => {
    const newConversation = createNewConversation();
    setConversations([newConversation, ...conversations]);
    setCurrentConversationId(newConversation.id);
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
  };

  const handleDeleteConversation = (id) => {
    const filtered = conversations.filter(conv => conv.id !== id);
    setConversations(filtered);
    
    if (currentConversationId === id) {
      if (filtered.length > 0) {
        setCurrentConversationId(filtered[0].id);
      } else {
        const newConversation = createNewConversation();
        setConversations([newConversation]);
        setCurrentConversationId(newConversation.id);
      }
    }
  };

  const handleUpdateConversation = (id, messages) => {
    setConversations(conversations.map(conv => {
      if (conv.id === id) {
        const title = messages.length > 0 
          ? messages[0].text.substring(0, 30) + (messages[0].text.length > 30 ? '...' : '')
          : 'New Chat';
        return { ...conv, messages, title };
      }
      return conv;
    }));
  };

  const handleClearAllChats = () => {
    const newConversation = createNewConversation();
    setConversations([newConversation]);
    setCurrentConversationId(newConversation.id);
    localStorage.removeItem('nyomi-conversations');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const currentConversation = conversations.find(conv => conv.id === currentConversationId);

  return (
    <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onClearAll={handleClearAllChats}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      <ChatWindow
        conversation={currentConversation}
        onUpdateConversation={handleUpdateConversation}
        darkMode={darkMode}
      />
    </div>
  );
}

export default App;
