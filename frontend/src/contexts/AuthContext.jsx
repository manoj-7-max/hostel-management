import { createContext, useContext, useMemo, useState } from "react";
import { loginRequest } from "../services/api.js";
import {
  clearStoredToken,
  clearStoredUser,
  getStoredToken,
  getStoredUser,
  setStoredHostelId,
  setStoredToken,
  setStoredUser
} from "../utils/storage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const storedUser = getStoredUser();
  const storedToken = storedUser?.role ? getStoredToken() : null;
  const [token, setToken] = useState(storedToken);
  const [user, setUser] = useState(storedUser?.role ? storedUser : null);

  const login = async (credentials) => {
    const data = await loginRequest(credentials);
    const nextToken = data.token || data.jwt || data.accessToken;
    const nextUser = data.user || {
      email: credentials.email,
      role: credentials.role,
      student_id: data.student_id,
      name: data.name
    };

    if (!nextToken) throw new Error("Login response did not include a token.");

    setStoredToken(nextToken);
    if (data.hostels?.[0]?.hostel_id) setStoredHostelId(data.hostels[0].hostel_id);
    setStoredUser({ ...nextUser, hostels: data.hostels || [], permissions: data.permissions || [] });
    setToken(nextToken);
    setUser({ ...nextUser, hostels: data.hostels || [], permissions: data.permissions || [] });
    return { ...nextUser, hostels: data.hostels || [], permissions: data.permissions || [] };
  };

  const logout = () => {
    clearStoredToken();
    clearStoredUser();
    localStorage.removeItem("hms_hostel_id");
    setToken(null);
    setUser(null);
  };

  const updateUser = (changes) => {
    const next = { ...user, ...changes };
    setStoredUser(next);
    setUser(next);
  };

  const value = useMemo(() => ({ token, user, login, logout, updateUser }), [token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
