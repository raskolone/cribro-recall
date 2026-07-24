
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
  signInAnonymously,
  linkWithPopup
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
  connectGoogleDrive: () => Promise<string>;
  connectGoogleWorkspace: () => Promise<string>;
  linkGoogleAccount: () => Promise<void>;
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
            let data = userDoc.data();
            if (firebaseUser.email && firebaseUser.email.toLowerCase().includes('maciej.wyrozumski') && data.role !== 'admin') {
              data.role = 'admin';
              try {
                await updateDoc(userDocRef, { role: 'admin' });
              } catch(e) {}
            }
            setUser({ id: firebaseUser.uid, ...data } as User);
          } else {
            // Create user document
            const defaultName = firebaseUser.isAnonymous ? 'Demo User' : (firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'));
            const email = firebaseUser.email || '';
            const role = email === 'maciej.wyrozumski@gmail.com' ? 'admin' : 'user';
            
            const newUser: User = {
              id: firebaseUser.uid,
              username: defaultName,
              email: email,
              role: role,
              photoURL: firebaseUser.photoURL || undefined
            };
            
            await setDoc(userDocRef, newUser);
            setUser(newUser);
          }
        } catch (error: any) {
          console.error("Error loading user profile from firestore:", error);
          const fallbackEmail = firebaseUser.email || '';
          setUser({
            id: firebaseUser.uid,
            username: firebaseUser.displayName || (fallbackEmail ? fallbackEmail.split('@')[0] : 'User'),
            email: fallbackEmail,
            role: fallbackEmail === 'maciej.wyrozumski@gmail.com' ? 'admin' : 'user'
          });
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
      const result = await signInWithPopup(auth, provider);
      await updateLoginStats(result.user.uid);
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') {
        console.error('Login failed:', error);
      }
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    await updateLoginStats(result.user.uid);
  };

  const updateLoginStats = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        await updateDoc(userRef, {
          loginCount: (userData.loginCount || 0) + 1,
          lastLoginDate: new Date().toISOString(),
          ...(userData.requirePasswordChange ? { tempPasswordLogins: (userData.tempPasswordLogins || 0) + 1 } : {})
        });
      }
    } catch (error) {
      console.error('Failed to update login stats:', error);
    }
  };

  const registerWithEmail = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  
  const linkGoogleAccount = async () => {
    try {
      if (!auth.currentUser) throw new Error('No user logged in');
      const provider = new GoogleAuthProvider();
      // Add drive scope just in case they link now, so they have it
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
      provider.addScope('https://www.googleapis.com/auth/documents.readonly');
      const result = await linkWithPopup(auth.currentUser, provider);
      if (result.user && result.user.photoURL) {
        const userDocRef = doc(db, 'users', result.user.uid);
        await updateDoc(userDocRef, { photoURL: result.user.photoURL });
        setUser(prev => prev ? { ...prev, photoURL: result.user.photoURL } : null);
      }
    } catch (error) {
      console.error('Failed to link Google account:', error);
      throw error;
    }
  };

  const connectGoogleDrive = async (): Promise<string> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
      // We can use signInWithPopup even if the user is already logged in with Google,
      // it will prompt them to add the new scopes.
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        return credential.accessToken;
      }
      throw new Error('No access token received');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error('Failed to connect Google Drive:', error);
      }
      throw error;
    }
  };

  const connectGoogleWorkspace = async (): Promise<string> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
      provider.addScope('https://www.googleapis.com/auth/documents.readonly');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential?.accessToken) {
        localStorage.setItem('google_workspace_access_token', credential.accessToken);
        return credential.accessToken;
      }
      throw new Error('No access token received');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error('Failed to connect Google Workspace:', error);
      }
      throw error;
    }
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
                 id: 'demo-id',
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
    <AuthContext.Provider value={{ user, isAuthReady, login, loginWithEmail, registerWithEmail, loginAnonymously, logout, updateUserStreak, connectGoogleDrive, connectGoogleWorkspace, linkGoogleAccount }}>
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
