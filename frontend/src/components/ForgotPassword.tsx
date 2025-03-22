import React, { useState } from "react";
import styled from "styled-components";
import './ForgotPassword.css';  // Burada CSS dosyasını import ettik

const ForgotPasswordContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(to right, #3b82f6, #8b5cf6);
`;

const FormContainer = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
`;

const Title = styled.h2`
  font-size: 2rem;
  font-weight: bold;
  color: rgb(77, 101, 140);
  text-align: center;
  margin-bottom: 1.5rem;
`;

const InputGroup = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.35rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  margin-top: 0.3rem;
  outline: none;
  transition: border-color 0.2s ease-in-out;
  
  &:focus {
    border-color: #3b82f6;
  }
`;

const Button = styled.button`
  background-color: #34d399;
  color: white;
  padding: 1rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  width: 100%;
  cursor: pointer;
  
  &:hover {
    background-color: #10b981;
  }
`;

const ForgotPassword = () => {
  const [username, setUsername] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Make API call to send password reset link (for example)
      const response = await fetch(`${process.env.REACT_APP_BACKEND_API_URL}/api/users/reset-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        throw new Error("Password reset failed");
      }

      alert("Password reset email sent!");
    } catch (err) {
      alert("Failed to send password reset email.");
    }
  };

  return (
    <ForgotPasswordContainer>
      <FormContainer>
        <Title>Forgot Password</Title>
        <form onSubmit={handleSubmit}>
          <InputGroup>
            <Label htmlFor="username">Username</Label>
            <Input
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={handleChange}
              required
            />
          </InputGroup>

          <Button type="submit">Reset Password</Button>
        </form>
      </FormContainer>
    </ForgotPasswordContainer>
  );
};

export default ForgotPassword;
