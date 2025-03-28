import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";  // Link import edilmesi gerekiyor
import styled from "styled-components";

// Styled components
const LoginContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-image: url('/loginBg.png');
  background-size: cover;
  background-position: center;
  
  @media (max-width: 768px) {
    background-image: url('/loginMobileBg.png');
  }
`;

const FormContainer = styled.div`
  background: rgba(255, 255, 255, 0.9);
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 24rem;
  backdrop-filter: blur(5px);
`;

const LogoContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
  width: 100%;
`;

const Logo = styled.img`
  width: 100%;
  max-width: 320px;
  height: auto;
`;

const Title = styled.h2`
  font-size: 1.875rem;
  font-weight: 700;
  color: #1e293b;
  text-align: center;
  margin-bottom: 1.5rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
`;

const Input = styled.input`
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const Button = styled.button`
  background: #22c55e;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: #15803d;
  }
`;

const ErrorMessage = styled.p`
  color: #ef4444;
  font-size: 0.875rem;
  text-align: center;
`;

const SuccessMessage = styled.p`
  color: #22c55e;
  font-size: 0.875rem;
  text-align: center;
  font-weight: 500;
`;

const GoogleButton = styled.button`
  background: white;
  color: #757575;
  padding: 0.5rem 1rem;
  border: 1px solid #dadce0;
  border-radius: 0.375rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  margin-top: 1rem;

  &:hover {
    background: #f8f9fa;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  text-align: center;
  margin: 1rem 0;
  color: #757575;
  font-size: 0.875rem;

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #dadce0;
  }

  &::before {
    margin-right: 0.5rem;
  }

  &::after {
    margin-left: 0.5rem;
  }
`;

// Login Component
const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Kullanıcı zaten giriş yapmışsa map'e yönlendir
    const token = localStorage.getItem("token");
    console.log("Login sayfası yüklendiğinde mevcut token:", token);
    
    if (token) {
      console.log("Token bulundu, haritaya yönlendiriliyor");
      navigate("/map");
      return;
    }
    
    // URL'deki token ve API anahtarlarını kontrol et (Google OAuth yönlendirmesinden sonra)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const hereApiKey = urlParams.get('here_api_key');
    const googleApiKey = urlParams.get('google_api_key');
    const isNewUser = urlParams.get('is_new_user');
    
    console.log("URL parametreleri:", {
      urlToken,
      hereApiKey,
      googleApiKey,
      isNewUser
    });
    
    if (urlToken) {
      console.log("Google OAuth yönlendirmesinden token alındı");
      
      // Token ve API anahtarlarını localStorage'a kaydet
      try {
        localStorage.setItem("token", urlToken);
        console.log("Token localStorage'a kaydedildi:", urlToken);
        
        if (hereApiKey) {
          localStorage.setItem("hereApiKey", hereApiKey);
          console.log("HERE API key localStorage'a kaydedildi");
        }
        
        if (googleApiKey) {
          localStorage.setItem("googleApiKey", googleApiKey);
          console.log("Google API key localStorage'a kaydedildi");
        }
        
        // Başarı durumunu kontrol et
        const savedToken = localStorage.getItem("token");
        console.log("Kaydedilen token kontrolü:", savedToken);
        
        if (savedToken !== urlToken) {
          console.error("Token localStorage'a kaydedilemedi!");
          setError("Token kaydedilemedi. Lütfen tarayıcı ayarlarınızı kontrol edin.");
          return;
        }
        
        // URL'i temizle
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Başarı mesajı göster
        setError(""); // Hata mesajını temizle
        
        // Yeni kullanıcı mı yoksa mevcut kullanıcı mı olduğunu belirt
        if (isNewUser === 'true') {
          setSuccess("Yeni hesabınız oluşturuldu! Haritaya yönlendiriliyorsunuz...");
        } else {
          setSuccess("Başarıyla giriş yaptınız! Haritaya yönlendiriliyorsunuz...");
        }
        
        // Haritaya yönlendir (kısa bir gecikme ile kullanıcının başarı mesajını görmesi için)
        setTimeout(() => {
          navigate("/map");
        }, 2000);
      } catch (error) {
        console.error("localStorage işlem hatası:", error);
        setError("Giriş bilgileri kaydedilemedi. Lütfen tarayıcı ayarlarınızı kontrol edin.");
      }
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // Send login credentials to the backend API
      const response = await fetch(`${process.env.REACT_APP_BACKEND_API_URL}/api/users/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: username, password: password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data && data.error) {
          // API'den dönen hata mesajını kullan
          throw new Error(data.error);
        } else {
          throw new Error("Giriş başarısız. Lütfen kullanıcı adı ve şifrenizi kontrol edin.");
        }
      }

      console.log(data);
      
      // Tüm response verilerini kaydedelim
      localStorage.setItem("token", data.token);
      localStorage.setItem("googleApiKey", data.google_api_key);
      localStorage.setItem("hereApiKey", data.here_api_key);

      // Redirect to the map page
      navigate("/map");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Giriş sırasında beklenmeyen bir hata oluştu.");
      }
    }
  };

  const handleGoogleLogin = () => {
    try {
      setError(""); // Önceki hata mesajlarını temizle
      setSuccess(""); // Başarı mesajını temizle
      
      // Google OAuth URL'ini oluştur
      const backendUrl = process.env.REACT_APP_BACKEND_API_URL;
      if (!backendUrl) {
        setError("Backend URL bulunamadı. Lütfen .env dosyasını kontrol edin.");
        return;
      }
      
      // Direkt olarak backend URL üzerinden Google OAuth'a yönlendir
      const googleOAuthUrl = `${backendUrl}/api/users/social-auth/login/google-oauth2/`;
      console.log("Google OAuth URL:", googleOAuthUrl);
      
      // Tarayıcıyı yönlendir
      window.location.href = googleOAuthUrl;
    } catch (error) {
      console.error("Google login hatası:", error);
      setError("Google ile giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.");
    }
  };

  return (
    <LoginContainer>
      <FormContainer>
        <LogoContainer>
          <Logo src="/landingLogo.png" alt="BitHub Logo" />
        </LogoContainer>
        <Form onSubmit={handleSubmit}>
          <InputGroup>
            <Label>Kullanıcı Adı</Label>
            <Input
              type="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </InputGroup>
          <InputGroup>
            <Label>Şifre</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </InputGroup>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {success && <SuccessMessage>{success}</SuccessMessage>}
          <Button type="submit">Giriş Yap</Button>
        </Form>
        <Divider>veya</Divider>
        <GoogleButton onClick={handleGoogleLogin}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          &nbsp;Google ile Giriş Yap
        </GoogleButton>
        {/* Link to the Register Page */}
        <p>Don't have an account? <Link to="/register">Create an account</Link></p>
      </FormContainer>
    </LoginContainer>
  );
};

export default Login;
