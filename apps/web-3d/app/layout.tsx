import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { vi } from '../src/ui/text/vi.ts';
import './globals.css';

export const metadata: Metadata = {
  title: vi.app.title,
  description: vi.app.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
