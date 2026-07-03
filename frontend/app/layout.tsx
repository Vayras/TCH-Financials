import type { Metadata } from 'next';
import { Host_Grotesk } from 'next/font/google';
import './globals.css';
import AuthGuard from '@/components/AuthGuard';

// Self-hosted via next/font: fonts are downloaded at build time and served
// from our own origin with no render-blocking Google Fonts CSS request.
// Host Grotesk is the single typeface for the whole app.
const hostGrotesk = Host_Grotesk({
	subsets: ['latin'],
	weight: ['400', '500', '600', '700'],
	display: 'swap',
	variable: '--font-host-grotesk'
});

export const metadata: Metadata = {
	title: 'TCH Financials — MIS',
	description: 'Management information system for TCH Financials.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={hostGrotesk.variable}>
			<head>
				<meta name="text-scale" content="scale" />
			</head>
			<body>
				<AuthGuard>{children}</AuthGuard>
			</body>
		</html>
	);
}
