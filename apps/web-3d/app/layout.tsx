import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { vi } from '../src/ui/text/vi.ts';
import '@netverse/ui/tokens.css';
import '@netverse/ui/components.css';
import './globals.css';

export const metadata: Metadata = {
  title: vi.app.title,
  description: vi.app.description,
  manifest: '/manifest.json',
  icons: {
    icon: '/pwa/icon-192.png',
    apple: '/pwa/apple-touch-icon.png',
  },
};

export const viewport: Viewport = { themeColor: '#0d0a18' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
