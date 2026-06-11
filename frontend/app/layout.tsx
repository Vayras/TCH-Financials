import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';
import AuthGuard from '@/components/AuthGuard';

// Self-hosted via next/font: fonts are downloaded at build time and served
// from our own origin with no render-blocking Google Fonts CSS request.
const inter = Inter({
	subsets: ['latin'],
	weight: ['400', '500', '600', '700'],
	display: 'swap',
	variable: '--font-inter'
});

const sourceSerif = Source_Serif_4({
	subsets: ['latin'],
	weight: ['400', '600', '700'],
	display: 'swap',
	variable: '--font-source-serif'
});

export const metadata: Metadata = {
	title: 'TCH Financials — MIS',
	description: 'Management information system for TCH Financials.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
			<head>
				<meta name="text-scale" content="scale" />
			</head>
			<body>
				<AuthGuard>{children}</AuthGuard>
			</body>
		</html>
	);
}
