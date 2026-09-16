import './globals.css';
import './batch.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MOVA AI Studio',
  description: 'Turn character images into motion videos using reference dance videos.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
