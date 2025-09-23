import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Admin, LoginForm } from '../types';
import { apiService } from '../services/api';

interface AuthContextType {
  admin: Admin | null;
  loading: boolean;
  login: (credentials: LoginForm) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        if (token) {
          const adminData = await apiService.getCurrentAdmin();
          setAdmin(adminData);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        localStorage.removeItem('admin_token');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginForm) => {
    try {
      const { admin: adminData } = await apiService.login(credentials);
      setAdmin(adminData);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setAdmin(null);
    apiService.logout();
  };

  const value: AuthContextType = {
    admin,
    loading,
    login,
    logout,
    isAuthenticated: !!admin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
