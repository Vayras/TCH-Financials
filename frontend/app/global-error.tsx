'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<html lang="en">
			<body className="min-h-screen grid place-items-center p-6 bg-white text-slate-900">
				<div role="alert" className="max-w-lg rounded-xl border border-red-200 bg-red-50 p-6">
					<h1 className="text-xl font-semibold">TCH Financials needs to reload</h1>
					<p className="mt-2 text-sm text-slate-700">Your last action may not have completed. Please reload before trying it again.</p>
					<button type="button" className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm text-white" onClick={reset}>Reload application</button>
				</div>
			</body>
		</html>
	);
}
