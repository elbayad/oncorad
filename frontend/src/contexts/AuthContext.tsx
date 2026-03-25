import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

// Configure axios defaults - utiliser URL relative pour proxy Vite
axios.defaults.baseURL = '/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  modules: string[];
  floor: number;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasModuleAccess: (module: string) => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const savedUser = localStorage.getItem('clinicUser');
      const savedToken = localStorage.getItem('clinicToken');

      if (savedUser && savedToken) {
        try {
          // Set axios authorization header
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;

          // Verify token is still valid
          const response = await axios.get('/auth/profile');

          if (response.data.success) {
            setUser(response.data.data);
          } else {
            // Token invalid, clear storage
            logout();
          }
        } catch (error) {
          logout();
        }
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const response = await axios.post('/auth/login', { email, password });

      if (response.data.success) {
        const { user, token } = response.data.data;

        // Store token in localStorage
        localStorage.setItem('clinicToken', token);

        // Set axios default authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        setUser(user);
        localStorage.setItem('clinicUser', JSON.stringify(user));
        setIsLoading(false);
        return true;
      }
    } catch (error: any) {
      setIsLoading(false);
      return false;
    }

    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('clinicToken');
    localStorage.removeItem('clinicUser');
    delete axios.defaults.headers.common['Authorization'];
  };

  const hasModuleAccess = (module: string): boolean => {
    return user?.modules.includes(module) || false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      hasModuleAccess,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}