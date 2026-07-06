/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import defaultFirebaseConfig from './firebase-applet-config.json';

const getFirebaseConfig = () => {
  let config: any = { ...defaultFirebaseConfig };
  try {
    if (import.meta.env.VITE_FIREBASE_CONFIG) {
      const parsed = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
      if (parsed && typeof parsed === 'object') {
        // Only override if the parsed config actually has valid looking values
        if (parsed.apiKey && parsed.apiKey !== '...' && parsed.apiKey !== 'your_firebase_api_key_here') config.apiKey = parsed.apiKey;
        if (parsed.authDomain && parsed.authDomain !== '...') config.authDomain = parsed.authDomain;
        if (parsed.projectId && parsed.projectId !== '...') config.projectId = parsed.projectId;
        if (parsed.storageBucket && parsed.storageBucket !== '...') config.storageBucket = parsed.storageBucket;
        if (parsed.messagingSenderId && parsed.messagingSenderId !== '...') config.messagingSenderId = parsed.messagingSenderId;
        if (parsed.appId && parsed.appId !== '...') config.appId = parsed.appId;
      }
    }
  } catch (e) {
    console.warn('Failed to parse VITE_FIREBASE_CONFIG, falling back to default');
  }

  // Also allow individual VITE_ vars to override, but ONLY if they look like real values
  const isValidOverride = (val: any) => typeof val === 'string' && val.trim() !== '' && val !== '...' && val !== 'your_firebase_api_key_here';

  if (isValidOverride(import.meta.env.VITE_FIREBASE_API_KEY)) config.apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (isValidOverride(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)) config.authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  if (isValidOverride(import.meta.env.VITE_FIREBASE_PROJECT_ID)) config.projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (isValidOverride(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)) config.storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  if (isValidOverride(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID)) config.messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  if (isValidOverride(import.meta.env.VITE_FIREBASE_APP_ID)) config.appId = import.meta.env.VITE_FIREBASE_APP_ID;

  return config;
};

export const firebaseConfig = getFirebaseConfig();

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  if (error?.code === 'unavailable' || errorMessage.includes('offline') || errorMessage.includes('unavailable')) {
     console.warn("Firestore is currently offline or unreachable.");
     return; // Do not throw to avoid crashing react tree
  }

  throw new Error(JSON.stringify(errInfo));
}
