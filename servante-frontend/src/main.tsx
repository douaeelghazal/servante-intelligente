import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ChatbotWidget from './components/chatbot/ChatbotWidget';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ChatbotWidget />
  </React.StrictMode>,
);
