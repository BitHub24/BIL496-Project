import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapComponent from "./components/MapComponent";
import { Toaster } from 'sonner';
import './App.css';
import Login from "./components/LoginComponent";
import RegisterComponent from "./components/RegisterComponent";
import SettingsPage from "./components/SettingsPage";

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // Check if user is logged in on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  // Handle logout
  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  // Handle successful login
  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  return (
    <BrowserRouter>
      <div className="App">
        <main>
          <Routes>
            <Route path="/" element={<Login onLoginSuccess={handleLoginSuccess} />} />
            <Route path="/map" element={<MapComponent isLoggedIn={isLoggedIn} onLogout={handleLogout} />} />
            <Route path="/register" element={<RegisterComponent />} />
            <Route path="/settings" element={<SettingsPage isLoggedIn={isLoggedIn} onLogout={handleLogout} />} />
          </Routes>
        </main>
        <Toaster position="top-center" richColors />
      </div>
    </BrowserRouter>
  );
};

export default App;
