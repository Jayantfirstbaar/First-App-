import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';

export interface AppUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName?: string | null;
  photoURL?: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  getIdToken: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  getIdToken: async () => null,
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          setUser(firebaseUser);
          setAuthError(null);
          setLoading(false);
        },
        (error) => {
          console.warn('Firebase Auth State Observer warning:', error?.message);
          setAuthError(error?.message || 'Firebase Auth error');
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
    if (auth.currentUser) {
      try {
        return await auth.currentUser.getIdToken(true);
      } catch (err: any) {
        console.warn('getIdToken refresh error:', err?.message);
      }
    }
    return null;
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.warn('SignOut warning:', err);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, getIdToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
