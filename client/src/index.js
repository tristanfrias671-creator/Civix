import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* English, like the rest of the staff and admin pages (Google would otherwise
        pick a language from the visitor's location). */}
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID} locale="en">
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
