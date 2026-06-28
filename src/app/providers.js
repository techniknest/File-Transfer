'use client';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from './components/ThemeProvider';
import { ToastProvider } from './components/Toast';

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <ToastProvider />
      </ThemeProvider>
    </SessionProvider>
  );
}