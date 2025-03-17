// frontend/src/components/Login.tsx
import React, { useState } from 'react';
import './Login.css';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Basit demo doğrulaması, örnek olarak:
    if (username === 'admin' && password === 'admin') {
      onLogin();
    } else {
      alert('Kullanıcı adı veya şifre hatalı!');
    }
  };

  return (
    <div className="login-container">
      <div className="card">
        <h2>Login Page</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Kullanıcı Adı"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">Giriş Yap</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
