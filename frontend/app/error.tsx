'use client';

import { useEffect } from 'react';
import QueryErrorState from '@/components/QueryErrorState';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		// The digest/request ID can be correlated with server logs without exposing stack traces to users.
		console.error('Page render failed', { digest: error.digest });
	}, [error]);
	return (
		<main className="min-h-screen grid place-items-center p-6">
			<div className="max-w-lg w-full">
				<QueryErrorState
					title="This page couldn’t be displayed"
					description="Your data was not changed. Try again, or contact support if the problem continues."
					onRetry={reset}
				/>
			</div>
		</main>
	);
}

