import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './hooks/AuthProvider';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#14142b',
              color: '#e2e8f0',
              border: '1px solid #1c1c38',
              borderRadius: '14px',
              fontSize: '13px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            },
            success: {
              iconTheme: { primary: '#34d399', secondary: '#080812' },
            },
            error: {
              iconTheme: { primary: '#f87171', secondary: '#080812' },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
