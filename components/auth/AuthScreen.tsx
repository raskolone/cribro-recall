
import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import Card from '../ui/Card';

interface AuthScreenProps {
  onBack?: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onBack }) => {
  const { login, loginWithEmail, registerWithEmail } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      await login();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(err.message || 'Google sign in failed');
      }
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setError('');
    setIsLoading(true);
    try {
      let formattedEmail = email;
      if (!email.includes('@')) {
        formattedEmail = `${email.toLowerCase().replace(/\s+/g, '')}@student.vocabboost.com`;
      }
      
      if (isLoginMode) {
        await loginWithEmail(formattedEmail, password);
      } else {
        await registerWithEmail(formattedEmail, password);
      }
    } catch (err: any) {
      let message = err.message || 'Authentication failed';
      if (err.code === 'auth/invalid-credential') message = 'Invalid username/email or password';
      if (err.code === 'auth/email-already-in-use') message = 'User is already registered';
      if (err.code === 'auth/weak-password') message = 'Password should be at least 6 characters';
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md relative">
        {onBack && (
          <button 
            onClick={onBack}
            className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        )}
        <div className="text-center mt-4 mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v1.5M12 9.75v6.5M18.375 9a8.25 8.25 0 01-12.75 0" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5a4.125 4.125 0 004.125-4.125h-8.25A4.125 4.125 0 0012 16.5z" />
            </svg>
          <h1 className="text-2xl font-bold mt-4">
            {isLoginMode ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-gray-500 mt-2">
            {isLoginMode ? 'Sign in to continue your learning journey.' : 'Sign up to start boosting your vocabulary.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Email or Username (Students)</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
              placeholder="you@example.com or username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Please wait...' : (isLoginMode ? 'Sign In' : 'Sign Up')}
          </Button>
        </form>

        <div className="mt-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-base-300 dark:border-dark-base-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-base-200 dark:bg-dark-base-200 text-gray-500">Or continue with</span>
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={handleGoogleLogin} variant="secondary" className="w-full flex items-center justify-center gap-2" disabled={isLoading}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-400">
          {isLoginMode ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError('');
            }} 
            className="text-primary hover:underline font-medium"
            disabled={isLoading}
          >
            {isLoginMode ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default AuthScreen;
