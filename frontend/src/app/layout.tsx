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
          <div className="flex min-h-screen bg-gray-50">
            <Sidebar />
            {/* Add pt-16 on mobile to account for hamburger menu, and pl-4 for spacing */}
            <main className="flex-1 pt-16 px-4 pb-4 md:pt-8 md:px-8 md:pb-8 md:ml-64">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
