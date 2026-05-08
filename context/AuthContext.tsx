
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  isAuthReady: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  loginAnonymously: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserStreak: () => Promise<{streakCount: number, showConfetti: boolean}>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            // Create user document
            const defaultName = firebaseUser.isAnonymous ? 'Demo User' : (firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'));
            const email = firebaseUser.email || '';
            const role = email === 'maciej.wyrozumski@gmail.com' ? 'admin' : 'user';
            
            const newUser: User = {
              username: defaultName,
              email: email,
              role: role,
              photoURL: firebaseUser.photoURL || undefined
            };
            
            await setDoc(userDocRef, newUser);
            setUser(newUser);
          }
        } catch (error: any) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          
          // If the error was offline and handleFirestoreError swallowed it, populate offline fallback user
          if (error?.code === 'unavailable' || error?.message?.includes('offline') || error?.message?.includes('unavailable')) {
             const fallbackEmail = firebaseUser.email || '';
             setUser({
               username: firebaseUser.isAnonymous ? 'Demo User (Offline)' : (firebaseUser.displayName || 'User (Offline)'),
               email: fallbackEmail,
               role: fallbackEmail === 'maciej.wyrozumski@gmail.com' ? 'admin' : 'user'
             });
          }
        }
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        console.error('Login failed:', error);
      }
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const loginAnonymously = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error('Anonymous login failed:', error);
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        try {
          await signInWithEmailAndPassword(auth, 'demo@vocabboost.com', 'demo123456');
        } catch (demoError: any) {
          console.error('Demo email login fallback failed:', demoError);
          if (demoError.code === 'auth/operation-not-allowed' || demoError.code === 'auth/admin-restricted-operation' || demoError.code === 'auth/user-not-found' || demoError.code === 'auth/invalid-credential' || demoError.code === 'auth/invalid-login-credentials') {
               // The user likely hasn't enabled ANY auth methods.
               // Setup a fully local mocked demo user without touching Firebase Auth.
               setUser({
                 username: 'Local Demo',
                 email: 'demo@vocabboost.com',
                 role: 'user'
               });
               // Prevent standard firestore errors from breaking the UI by telling the system we are "Auth Ready"
               setIsAuthReady(true);
           } else if (demoError.code === 'auth/email-already-in-use') {
               await signInWithEmailAndPassword(auth, 'demo@vocabboost.com', 'demo123456');
           } else {
               throw demoError;
           }
        }
      } else {
        throw error;
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const updateUserStreak = async (): Promise<{streakCount: number, showConfetti: boolean}> => {
    if (!user || user.username === 'Local Demo') {
      return { streakCount: user?.streakCount || 0, showConfetti: false };
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day
      const todayStr = today.toISOString();
      const currentStreak = user.streakCount || 0;
      
      let newStreak = currentStreak;
      let showConfetti = false;

      // Check if they already practiced today
      if (user.lastStreakDate) {
        const lastDate = new Date(user.lastStreakDate);
        lastDate.setHours(0, 0, 0, 0);
        
        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays === 0) {
          // Already practiced today, don't increment, but maybe still show confetti if they want
          showConfetti = true; 
        } else if (diffDays === 1) {
          // Perfect streak continuation
          newStreak += 1;
          showConfetti = true;
        } else {
          // Break in streak
          newStreak = 1;
          showConfetti = true;
        }
      } else {
        // First time
        newStreak = 1;
        showConfetti = true;
      }

      if (auth.currentUser) {
         const userDocRef = doc(db, 'users', auth.currentUser.uid);
         await updateDoc(userDocRef, {
           streakCount: newStreak,
           lastStreakDate: todayStr
         });
      }

      const updatedUser = { ...user, streakCount: newStreak, lastStreakDate: todayStr };
      setUser(updatedUser);
      return { streakCount: newStreak, showConfetti };

    } catch (error) {
      console.error('Error updating config', error);
      return { streakCount: user.streakCount || 0, showConfetti: false };
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthReady, login, loginWithEmail, registerWithEmail, loginAnonymously, logout, updateUserStreak }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
