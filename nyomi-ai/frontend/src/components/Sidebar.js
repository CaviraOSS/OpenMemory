import React from 'react';
import { FiPlus, FiMessageSquare, FiTrash2, FiMoon, FiSun } from 'react-icons/fi';
import './Sidebar.css';

function Sidebar({ 
  conversations, 
  currentConversationId, 
  onNewChat, 
  onSelectConversation, 
  onDeleteConversation,
  onClearAll,
  darkMode,
  onToggleDarkMode
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">Nyomi AI 🤍</h1>
        <button className="new-chat-btn" onClick={onNewChat} title="New Chat">
          <FiPlus size={20} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="conversations-list">
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
            onClick={() => onSelectConversation(conv.id)}
          >
            <FiMessageSquare size={16} />
            <span className="conversation-title">{conv.title}</span>
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConversation(conv.id);
              }}
              title="Delete conversation"
            >
              <FiTrash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="theme-toggle-btn" onClick={onToggleDarkMode} title="Toggle theme">
          {darkMode ? <FiSun size={18} /> : <FiMoon size={18} />}
          <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button className="clear-all-btn" onClick={onClearAll} title="Clear all chats">
          <FiTrash2 size={16} />
          <span>Clear All</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
