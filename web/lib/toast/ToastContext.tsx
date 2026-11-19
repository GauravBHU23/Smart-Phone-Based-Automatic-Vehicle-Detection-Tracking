"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastState | undefined>(undefined);

const AUTO_DISMISS_MS = 3500;

const KIND_STYLES: Record<ToastKind, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-blue-100 bg-accent-light text-accent-dark",
};

const KIND_ICON: Record<ToastKind, string> = {
  success: "✅",
  error: "⚠️",
  info: "ℹ️",
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      timersRef.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-14 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${KIND_STYLES[t.kind]} animate-[toast-in_0.2s_ease-out]`}
          >
            <span className="text-base">{KIND_ICON[t.kind]}</span>
            <span className="flex-1 text-sm font-semibold">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-sm font-bold opacity-60 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
