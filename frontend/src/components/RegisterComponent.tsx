import React, { useState } from "react";
import styled, { keyframes, css } from "styled-components";

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-5px); }
`;

const RegisterContainer = styled.div`
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
  margin: 0 10px;
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

const Input = styled.input<{ $error?: boolean; $shake?: boolean }>`
  width: 100%;
  padding: 0.35rem;
  border: 1px solid ${({ $error }) => ($error ? "#ef4444" : "#d1d5db")};
  border-radius: 8px;
  font-size: 1rem;
  margin-top: 0.3rem;
  outline: none;
  transition: border-color 0.2s ease-in-out;
  
  ${({ $error }) =>
    $error &&
    css`
      box-shadow: 0 0 5px #ef4444;
    `}

  ${({ $shake }) =>
    $shake &&
    css`
      animation: ${shake} 0.3s ease-in-out;
    `}

  &:focus {
    border-color: ${({ $error }) => ($error ? "#ef4444" : "#3b82f6")};
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

const AlreadyAccount = styled.p`
  text-align: center;
  margin-top: 1rem;
  font-size: 0.875rem;
`;

const ErrorMessage = styled.p`
  color: #ef4444;
  font-size: 0.875rem;
  text-align: center;
`;

const Register = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    first_name: "",
    last_name: "",
  });

  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    
    // Reset password error when the user starts typing again
    if (name === "password" || name === "confirmPassword") {
      setPasswordError(false);
      setShake(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Check password match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      setPasswordError(true);
      setShake(true);
      return;
    }

    try {
      const { confirmPassword, ...data } = formData;
      const response = await fetch(`${BACKEND_API_URL}/api/users/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Registration failed");
      }

      setSuccess(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    }
  };

  return (
    <RegisterContainer>
      <FormContainer>
        <Title>Register your account</Title>
        {success ? (
          <p>Registration successful! Please <a href="/">login</a>.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <InputGroup>
              <Label htmlFor="first_name">First Name</Label>
              <Input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="username">Username</Label>
              <Input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="email">Email address</Label>
              <Input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                $error={passwordError}
                $shake={shake}
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                type="password"
                id="confirm_password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                $error={passwordError}
                $shake={shake}
              />
            </InputGroup>

            {error && <ErrorMessage>{error}</ErrorMessage>}
            <Button type="submit">Sign up</Button>
          </form>
        )}
        <AlreadyAccount>
          Already have an account? <a href="/">Sign in</a>.
        </AlreadyAccount>
      </FormContainer>
    </RegisterContainer>
  );
};

export default Register;
