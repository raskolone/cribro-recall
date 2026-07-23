import React, { Component, ErrorInfo, ReactNode } from 'react';
import BugReporter from './BugReporter';
import i18n from "i18next";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      // In case of error, show the original layout structure but with the error state
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center space-y-6">
            <h1 className="text-3xl font-bold text-red-500">{i18n.t("Wystąpił błąd aplikacji")}</h1>
            <p className="text-content-muted">
              
                                    {i18n.t("Przepraszamy, coś poszło nie tak. Możesz odświeżyć stronę lub zgłosić ten problem.")}
                                  </p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
              >
                
                                          {i18n.t("Odśwież stronę")}
                                        </button>
              <button 
                onClick={this.handleReset}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
              >
                
                                          {i18n.t("Spróbuj kontynuować")}
                                        </button>
            </div>
          </div>
          <BugReporter 
            errorContext={`${this.state.error?.toString()}\n\n${this.state.errorInfo?.componentStack}`}
            onCloseError={this.handleReset}
          />
        </div>
      );
    }

    return (
      <>
        {this.props.children}
        <BugReporter />
      </>
    );
  }
}

export default GlobalErrorBoundary;
