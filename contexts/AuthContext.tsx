import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, CollectionName } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginAsDemo: () => void; // New function for testing
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  loginAsDemo: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // If we are in demo mode (currentUser set manually), ignore null updates from firebase init
      if (!user && currentUser?.email === 'demo@mgr.com') {
          setLoading(false);
          return;
      }

      setCurrentUser(user);
      
      if (user) {
        try {
          const docRef = doc(db, CollectionName.USERS, user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // Fallback profile if doc doesn't exist yet
            setUserProfile({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Usuário',
              role: 'pending', // Default to pending for security
              xp: 0,
              level: 1,
              createdAt: null as any
            });
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginAsDemo = () => {
    const demoUser = {
      uid: 'demo-admin-123',
      email: 'demo@mgr.com',
      displayName: 'Admin de Teste',
      emailVerified: true,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      refreshToken: '',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => 'mock-token',
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({}),
      phoneNumber: null,
      photoURL: null,
      providerId: 'firebase'
    } as unknown as User;

    setCurrentUser(demoUser);
    setUserProfile({
      uid: 'demo-admin-123',
      email: 'demo@mgr.com',
      displayName: 'Admin de Teste',
      role: 'admin', // Full access
      xp: 5000,
      level: 10,
      createdAt: null as any
    });
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, loginAsDemo }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};