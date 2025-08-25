import './globals.css';

export const metadata = {
  title: 'My Garden',
  description: 'A simple app to manage your garden plants.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}