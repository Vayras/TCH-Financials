import type { Metadata } from 'next';
import './globals.css';
import AuthGuard from '@/components/AuthGuard';
import QueryProvider from '@/components/QueryProvider';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
	title: 'TCH Financials — MIS',
	description: 'Management information system for TCH Financials.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta name="text-scale" content="scale" />
			</head>
			<body>
				<QueryProvider>
					<AuthGuard>{children}</AuthGuard>
					<Toaster position="top-right" richColors closeButton />
				</QueryProvider>
			</body>
		</html>
	);
}
