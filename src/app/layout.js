import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'P2P Transfer — Fast & Secure File Sharing',
  description: 'Transfer files directly peer-to-peer without uploading to any server. Lightning fast, end-to-end encrypted, no size limits.',
  keywords: 'file transfer, p2p, peer-to-peer, file sharing, secure, webrtc, no cloud',
  openGraph: {
    title: 'P2P Transfer — Fast & Secure File Sharing',
    description: 'Transfer files directly peer-to-peer without uploading to any server.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}