import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

export const metadata = {
  title: 'My Garden',
  description: 'Track and manage your garden plants',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}