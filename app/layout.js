import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

export const metadata = {
  title: 'My Garden',
  description: 'Track and manage your garden plants',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}