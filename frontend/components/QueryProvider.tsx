'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GlobalActivityIndicator from '@/components/GlobalActivityIndicator';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = React.useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000,
						refetchOnWindowFocus: false
					}
				}
			})
	);

	return <QueryClientProvider client={queryClient}><GlobalActivityIndicator />{children}</QueryClientProvider>;
}
