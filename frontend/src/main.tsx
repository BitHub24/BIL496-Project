import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { GoogleOAuthProvider } from '@react-oauth/google';
// Import Font Awesome configuration
import './fontawesome';
// Import custom route styles
import './styles/route-styles.css';

const googleClientID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
console.log('Google Client ID:', googleClientID); // Log the Google Client ID to check if it's loaded correctly
console.log('Backend URL:', import.meta.env.VITE_BACKEND_API_URL); // Log the backend URL to check if it's loaded correctly


const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientID as string}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
