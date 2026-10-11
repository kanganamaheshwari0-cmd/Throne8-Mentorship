
import { useState, useContext } from "react";
import { AuthContext } from "./AuthContextObject";
import api from "../services/api";

// AUTH PROVIDER
export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem("throne8_token")
  );

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("throne8_user")
      ) || null;
    } catch {
      return null;
    }
  });

  // LOGIN
  const login = async (email, password) => {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    const data = response.data;

    if (!data.success || !data.token || !data.user) {
      throw new Error(data.message || "Login failed");
    }

    localStorage.setItem("throne8_token", data.token);
    localStorage.setItem(
      "throne8_user",
      JSON.stringify(data.user)
    );

    setToken(data.token);
    setUser(data.user);

    return data.user;
  };

  // REGISTER
  const register = async (name, email, password) => {
    const response = await api.post("/auth/register", {
      name,
      email,
      password,
    });

    return response.data;
  };

  // LOGOUT
  const logout = () => {
    localStorage.removeItem("throne8_token");
    localStorage.removeItem("throne8_user");

    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ token, user, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// CUSTOM HOOK
export function useAuth() {
  return useContext(AuthContext);
}
