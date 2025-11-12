import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiMic, FiMicOff } from 'react-icons/fi';
import './InputBox.css';

function InputBox({ onSendMessage, disabled }) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + ' ' + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSendMessage(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className="input-box">
      <form onSubmit={handleSubmit} className="input-form">
        <button
          type="button"
          className={`voice-btn ${isListening ? 'listening' : ''}`}
          onClick={toggleVoiceInput}
          disabled={disabled}
          title={isListening ? 'Stop listening' : 'Voice input'}
        >
          {isListening ? <FiMicOff size={20} /> : <FiMic size={20} />}
        </button>
        
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Message Nyomi AI..."
          disabled={disabled}
          rows={1}
          className="message-input"
        />
        
        <button
          type="submit"
          className="send-btn"
          disabled={!input.trim() || disabled}
          title="Send message"
        >
          <FiSend size={20} />
        </button>
      </form>
      <div className="input-hint">
        Press Enter to send, Shift + Enter for new line
      </div>
    </div>
  );
}

export default InputBox;
