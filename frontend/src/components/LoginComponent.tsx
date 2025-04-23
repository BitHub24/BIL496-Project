import { useGoogleLogin } from "@react-oauth/google";
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";  // Link import edilmesi gerekiyor
import styled, { keyframes } from 'styled-components';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Loader = styled.div`
  border: 4px solid #f3f3f3;
  border-top: 4px solid #333;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: ${spin} 1s linear infinite;
  margin: 2rem auto;
`;

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
/*
const Title = styled.h2`
  font-size: 1.875rem;
  font-weight: 700;
  color: #1e293b;
  text-align: center;
  margin-bottom: 1.5rem;
`;
*/
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
  const [success] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // Send login credentials to the backend API
      const response = await fetch(`${BACKEND_API_URL}/api/users/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: username, password: password }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      // Parse the response
      const data = await response.json();
      console.log("Login response data:", data); // Log the response to check its structure

      // Store API keys AND the authentication token
      if (data.token) { 
        localStorage.setItem("token", data.token); // Store the token
        console.log("Token stored in localStorage");
      } else {
        console.error("Token not found in login response!");
        throw new Error("Login successful, but token missing in response."); // Throw error if token is missing
      }

      if (data.google_api_key) {
        localStorage.setItem("googleApiKey", data.google_api_key);
      }
      if (data.here_api_key) {
        localStorage.setItem("hereApiKey", data.here_api_key);
      }

      // Set login state (assuming you have a global state or context)
      // setIsLoggedIn(true); // Example - replace with your actual state update

      // Redirect to the map page
      navigate("/map");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred during login");
      }
    }
  };
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log('Access token:', tokenResponse.access_token);
      
      try {
        // Send the access token to the backend to verify and handle user creation
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });
  
        const googleAuthResult = await res.json();
        console.log('Google Auth Result:', googleAuthResult);
        if (googleAuthResult.email) {
          setLoading(true);
          const response = await fetch(`${BACKEND_API_URL}/api/users/google-auth/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleAuthResult),
          });
    
          if (!response.ok) {
            throw new Error("Registration failed"+response.statusText);
          }
          navigate('/map');
        } else {
          console.error('Authentication failed:', googleAuthResult);
        }
      } catch (error) {
        console.error('Error during Google login process:', error);
      }
      finally{
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google Login Failed:', error);
    },
  });
  
  return (
    <LoginContainer>
      {loading ? (
        <Loader />
      ) : (
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
          <GoogleButton onClick={() => googleLogin()}>
            {/* SVG icon */}
            &nbsp;Google ile Giriş Yap
          </GoogleButton>
          <p>Don't have an account? <Link to="/register">Create an account</Link></p>
        </FormContainer>
      )}
    </LoginContainer>
  );
}

export default Login;
