'use client';

import * as React from 'react';

// Indian FY starts Apr 1. Returns the calendar year the current FY started in
// (e.g. May 2026 → 2026, January 2026 → 2025).
function getCurrentFiscalYearStart(): number {
	const now = new Date();
	const month = now.getMonth(); // 0-indexed
	return month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

// Build selectable options: always include 2025 as the earliest, extend up to
// next FY so the upcoming year appears as soon as work starts on it.
function buildFyOptions(): number[] {
	const currentFY = getCurrentFiscalYearStart();
	const first = 2025;
	const last = Math.max(currentFY + 1, 2027);
	return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

const STORAGE_KEY = 'tch.fyStart';

type FiscalYearCtx = {
	// null during SSR and the brief pre-hydration window — consumers should
	// treat null as "not yet resolved" and avoid rendering FY-dependent data.
	fyStart: number | null;
	setFyStart: (year: number) => void;
	fyOptions: number[];
};

const FiscalYearContext = React.createContext<FiscalYearCtx | null>(null);

export function FiscalYearProvider({ children }: { children: React.ReactNode }) {
	// null initial state → no SSR default, no hydration mismatch.
	const [fyStart, setFyStartState] = React.useState<number | null>(null);
	const [fyOptions, setFyOptions] = React.useState<number[]>([]);

	// Runs only in the browser — safe to read localStorage and compute date.
	React.useEffect(() => {
		const options = buildFyOptions();
		setFyOptions(options);

		const saved = Number(window.localStorage.getItem(STORAGE_KEY));
		// Use saved preference if it's still a valid option, otherwise default to current FY.
		setFyStartState(options.includes(saved) ? saved : getCurrentFiscalYearStart());
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
		<FiscalYearContext.Provider value={{ fyStart, setFyStart, fyOptions }}>
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
