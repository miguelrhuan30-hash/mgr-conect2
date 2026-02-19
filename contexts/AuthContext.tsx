import React, { createContext, useContext, useEffect, useState } from 'react';
import firebase from '../firebase';
import { auth, db } from '../firebase';
import { UserProfile, CollectionName } from '../types';

interface AuthContextType {
  currentUser: firebase.User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginAsDemo: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  loginAsDemo: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: () => void;

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      // Demo Mode Check
      if (!user && currentUser?.email === 'demo@mgr.com') {
          setLoading(false);
          return;
      }

      setCurrentUser(user);
      
      if (user) {
        // --- SUPER ADMIN OVERRIDE (Blindagem) ---
        // Garante acesso total imediato para o e-mail mestre, independente do banco de dados.
        if (user.email?.toLowerCase() === 'gestor@mgr.com') {
           setUserProfile({
              uid: user.uid,
              email: user.email,
              displayName: 'Gestor Mestre',
              role: 'admin', // Força permissão máxima
              xp: 0,
              level: 1, // Zerado para Nível 1
              createdAt: firebase.firestore.Timestamp.now(),
              // Garante que não haja restrições de horário ou local
              workSchedule: { startTime: '00:00', endTime: '23:59', lunchDuration: 0 },
              allowedLocationIds: [],
              // Permissões explícitas para garantir acesso total sem bloqueio de ponto
              permissions: {
                canManageUsers: true,
                canManageSettings: true,
                canManageSectors: true,
                canViewTasks: true,
                canCreateTasks: true,
                canEditTasks: true,
                canDeleteTasks: true,
                canManageClients: true,
                canManageProjects: true,
                canViewInventory: true,
                canManageInventory: true,
                canRegisterAttendance: true,
                canViewAttendanceReports: true,
                canManageAttendance: true,
                requiresTimeClock: false, // CRÍTICO: Mestre não precisa bater ponto
                canViewFinancial: true,
                canManageFinancial: true,
              }
           });
           setLoading(false);
           return; 
        }

        // Real-time listener for User Profile updates
        try {
          const docRef = db.collection(CollectionName.USERS).doc(user.uid);
          
          unsubscribeProfile = docRef.onSnapshot((docSnap) => {
            if (docSnap.exists) {
              const data = docSnap.data() as UserProfile;
              // Ensure permissions object exists and has default values for critical new fields
              const patchedPermissions = {
                  ...data.permissions,
                  canViewAttendanceReports: data.permissions?.canViewAttendanceReports ?? false
              };
              setUserProfile({ ...data, permissions: patchedPermissions });
            } else {
              // Fallback profile if doc doesn't exist yet
              setUserProfile({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Usuário',
                role: 'pending', 
                xp: 0,
                level: 1,
                createdAt: null as any
              });
            }
            setLoading(false);
          }, (error) => {
            console.error("Error listening to user profile:", error);
            setLoading(false);
          });
          
        } catch (err) {
          console.error("Error setting up profile listener:", err);
          setLoading(false);
        }
      } else {
        setUserProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
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
    } as unknown as firebase.User;

    setCurrentUser(demoUser);
    setUserProfile({
      uid: 'demo-admin-123',
      email: 'demo@mgr.com',
      displayName: 'Admin de Teste',
      role: 'admin',
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