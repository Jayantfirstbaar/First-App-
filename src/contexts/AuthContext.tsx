import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';

export interface AppUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName?: string | null;
  photoURL?: string | null;
  getIdToken?: (forceRefresh?: boolean) => Promise<string>;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  authError: string | null;
  getIdToken: () => Promise<string | null>;
  loginAsDemoUser: (email?: string, name?: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  getIdToken: async () => null,
  loginAsDemoUser: () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check if there is a local demo/preview user session saved
    const savedDemoUser = localStorage.getItem('quoteback_demo_user');
    if (savedDemoUser) {
      try {
        const parsed = JSON.parse(savedDemoUser);
        setUser(parsed);
        setLoading(false);
      } catch {
        localStorage.removeItem('quoteback_demo_user');
      }
    }

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          if (firebaseUser) {
            setUser(firebaseUser);
            setAuthError(null);
            localStorage.removeItem('quoteback_demo_user');
          } else if (!localStorage.getItem('quoteback_demo_user')) {
            setUser(null);
          }
          setLoading(false);
        },
        (error) => {
          console.warn('Firebase Auth State Observer warning:', error?.message);
          setAuthError(error?.message || 'Firebase Auth service notification');
          setLoading(false);
        }
      );
    } catch (err: any) {
      console.warn('Firebase Auth initialization warning:', err?.message);
      setAuthError(err?.message || 'Firebase Auth initialization warning');
      setLoading(false);
    }

    return () => unsubscribe();
  }, []);

  const getIdToken = async () => {
    if (user && typeof user.getIdToken === 'function') {
      try {
        return await user.getIdToken(true);
      } catch (err: any) {
        console.warn('getIdToken refresh warning, returning uid:', err?.message);
        return user.uid;
      }
    }
    return user?.uid || localStorage.getItem('quoteback_auth_token') || 'user_sharma';
  };

  const loginAsDemoUser = (email = 'sharma.interiors@example.com', name = 'Rajesh Sharma') => {
    const demo: AppUser = {
      uid: 'user_sharma',
      email,
      emailVerified: true,
      displayName: name,
    };
    setUser(demo);
    localStorage.setItem('quoteback_demo_user', JSON.stringify(demo));
    localStorage.setItem('quoteback_auth_token', 'user_sharma');
    setLoading(false);
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.warn('SignOut warning:', err);
    }
    localStorage.removeItem('quoteback_demo_user');
    localStorage.removeItem('quoteback_auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, getIdToken, loginAsDemoUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
