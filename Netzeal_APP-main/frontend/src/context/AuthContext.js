/**
 * Simple Auth Context to share auth state across navigation
 */
import React, { createContext } from 'react';

export const AuthContext = createContext({
  isAuthenticated: false,
  setIsAuthenticated: () => {},
});

export const AuthProvider = ({ value, children }) => (
  <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
);
