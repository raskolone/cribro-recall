import React, { Component, ErrorInfo, ReactNode } from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (e) {
      console.error("Logout failed", e);
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] text-white p-4">
          <div className="bg-red-500/10 border border-red-500 p-8 rounded-2xl max-w-lg w-full text-center">
            <h1 className="text-2xl font-bold mb-4">Wystąpił błąd aplikacji</h1>
            <p className="mb-6 opacity-80">
              Coś poszło nie tak i aplikacja nie mogła zostać poprawnie wyświetlona.
              Spróbuj się wylogować i zalogować ponownie.
            </p>
            <div className="bg-black/20 p-4 rounded-lg text-left overflow-auto text-xs text-red-300 font-mono mb-6 max-h-40">
              {this.state.error?.toString()}
            </div>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={this.handleLogout}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Wyloguj i zresetuj
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
              >
                Odśwież
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
