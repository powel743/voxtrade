// ─────────────────────────────────────────────────────────────────────────────
// Entry point — React Query provider + error boundary
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    },
    mutations: {
      retry: 0,
    },
  },
});

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: unknown): void {
    // eslint-disable-next-line no-console
    console.error("VoxTrade crashed:", error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-center">
          <div className="max-w-md rounded-2xl border border-card-border bg-card p-8">
            <div className="text-4xl">⚠</div>
            <h1 className="mt-3 text-xl font-bold text-text-primary">Something went wrong</h1>
            <p className="mt-2 text-sm text-text-secondary">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-gold px-5 py-2 font-semibold text-bg hover:brightness-110"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
