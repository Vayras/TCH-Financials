'use client';

import * as React from 'react';

// Fiscal years selectable site-wide. Indian FY runs Apr → Mar, keyed by the
// starting calendar year (2025 = FY 25-26).
export const FY_OPTIONS = [2025, 2026, 2027];
const STORAGE_KEY = 'tch.fyStart';

type FiscalYearCtx = {
	fyStart: number;
	setFyStart: (year: number) => void;
};

const FiscalYearContext = React.createContext<FiscalYearCtx | null>(null);

export function FiscalYearProvider({ children }: { children: React.ReactNode }) {
	const [fyStart, setFyStartState] = React.useState<number>(2025);

	// Hydrate from localStorage after mount so the choice survives reloads and
	// page navigation, without causing an SSR/CSR markup mismatch.
	React.useEffect(() => {
		const saved = Number(window.localStorage.getItem(STORAGE_KEY));
		if (FY_OPTIONS.includes(saved)) setFyStartState(saved);
	}, []);

	const setFyStart = React.useCallback((year: number) => {
		setFyStartState(year);
		try {
			window.localStorage.setItem(STORAGE_KEY, String(year));
		} catch {
			/* ignore storage failures (private mode, etc.) */
		}
	}, []);

	return (
		<FiscalYearContext.Provider value={{ fyStart, setFyStart }}>
			{children}
		</FiscalYearContext.Provider>
	);
}

export function useFiscalYear(): FiscalYearCtx {
	const ctx = React.useContext(FiscalYearContext);
	if (!ctx) throw new Error('useFiscalYear must be used within a FiscalYearProvider');
	return ctx;
}

export function fyLabel(start: number): string {
	return `FY ${start % 100}-${(start + 1) % 100}`;
}
