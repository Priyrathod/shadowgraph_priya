import { createContext, useContext, useMemo, useState } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = ({ message, type = 'info', duration = 2200 }) => {
    setToast({ message, type });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), duration);
  };

  const value = useMemo(
    () => ({
      showToast,
      success: (message, duration) => showToast({ message, type: 'success', duration }),
      error: (message, duration) => showToast({ message, type: 'error', duration }),
      info: (message, duration) => showToast({ message, type: 'info', duration })
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast show={Boolean(toast)} message={toast?.message || ''} type={toast?.type || 'info'} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return value;
}
