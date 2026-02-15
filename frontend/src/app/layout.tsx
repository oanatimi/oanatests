import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Client Management System',
  description: 'Manage clients and send SMS messages',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 md:ml-64">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
