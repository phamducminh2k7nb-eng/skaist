import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MOVA AI Studio',
  description: 'Turn a character image into motion using a reference dance video.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
