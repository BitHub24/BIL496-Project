import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import MapComponent from "./components/MapComponent";
import { Toaster } from 'sonner';
import './App.css';
import Login from "./components/LoginComponent";
import RegisterComponent from "./components/RegisterComponent";
import axios from 'axios';

// Axios interceptor setup
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Auth işlemlerini gerçekleştiren özel bir yönlendirme sayfası
const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const hereApiKey = params.get("here_api_key");
    const googleApiKey = params.get("google_api_key");
    const isNewUser = params.get("is_new_user");
    
    console.log("Auth callback sayfasına gelen parametreler:", {
      token, hereApiKey, googleApiKey, isNewUser
    });
    
    if (!token) {
      setError("Token bulunamadı. Giriş yapılamadı.");
      return;
    }
    
    try {
      // Tüm değerleri localStorage'a kaydet
      localStorage.setItem("token", token);
      
      if (hereApiKey) localStorage.setItem("hereApiKey", hereApiKey);
      if (googleApiKey) localStorage.setItem("googleApiKey", googleApiKey);
      
      // Başarılı giriş kontrolü
      const storedToken = localStorage.getItem("token");
      if (storedToken !== token) {
        throw new Error("Token kaydedilemedi");
      }
      
      // Harita sayfasına yönlendir
      navigate("/map", { replace: true });
    } catch (err) {
      console.error("Giriş sırasında hata:", err);
      setError("Giriş bilgileri kaydedilemedi. Lütfen tarayıcı ayarlarınızı kontrol edin.");
    }
  }, [location.search, navigate]);
  
  // Hata durumunda bir mesaj göster
  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h2>Giriş Hatası</h2>
        <p>{error}</p>
        <button 
          onClick={() => navigate("/")} 
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#5e35b1', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Giriş Sayfasına Dön
        </button>
      </div>
    );
  }
  
  // Yönlendirme sırasında yükleniyor mesajı
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <p>Giriş yapılıyor, lütfen bekleyin...</p>
    </div>
  );
};

// URL parametrelerini kontrol eden ve işleyen bileşen
const UrlParamHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    // URL'den parametreleri al
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const hereApiKey = params.get("here_api_key");
    const googleApiKey = params.get("google_api_key");
    
    // Eğer parametreler varsa ve henüz işlenmediyse
    if ((token || hereApiKey || googleApiKey) && !processed) {
      console.log("Processing URL parameters");
      
      // Token varsa kaydet
      if (token) {
        localStorage.setItem("token", token);
        console.log("Token saved");
      }
      
      // API anahtarları varsa kaydet
      if (hereApiKey) {
        localStorage.setItem("hereApiKey", hereApiKey);
      }
      
      if (googleApiKey) {
        localStorage.setItem("googleApiKey", googleApiKey);
      }
      
      // İşlem tamamlandı olarak işaretle
      setProcessed(true);
      
      // URL'den parametreleri temizle
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, processed]);

  return null;
};

const App = () => {
  // Token'ın varlığını kontrol etme işlevi
  const isLoggedIn = () => {
    return localStorage.getItem("token") !== null;
  };

  return (
    <BrowserRouter>
      <UrlParamHandler />
      <div className="App">
        <main>
          <Routes>
            <Route path="/" element={isLoggedIn() ? <Navigate to="/map" /> : <Login />} />
            <Route path="/map" element={isLoggedIn() ? <MapComponent /> : <Navigate to="/" />} />
            <Route path="/register" element={<RegisterComponent />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </main>
        <Toaster position="top-center" richColors />
      </div>
    </BrowserRouter>
  );
};

export default App;
