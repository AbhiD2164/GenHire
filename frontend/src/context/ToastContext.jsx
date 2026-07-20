import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "default") => {
    setToast({ message, type, key: Date.now() });
    window.clearTimeout(window.__genhireToastTimer);
    window.__genhireToastTimer = window.setTimeout(() => setToast(null), 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className={`toast ${toast.type === "error" ? "toast-error" : toast.type === "success" ? "toast-success" : ""}`} key={toast.key}>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
