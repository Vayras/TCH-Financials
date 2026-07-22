'use client';

import * as React from 'react';

/** Returns the latest value after it has remained unchanged for delayMs. */
export function useDebounce<T>(value: T, delayMs = 500): T {
	const [debouncedValue, setDebouncedValue] = React.useState(value);

	React.useEffect(() => {
		const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
		return () => window.clearTimeout(timeoutId);
	}, [value, delayMs]);

	return debouncedValue;
}

export default useDebounce;
