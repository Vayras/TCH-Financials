import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

export function inr(value: string | number | null | undefined): string {
	if (value === null || value === undefined || value === '') return '';
	const n = typeof value === 'string' ? Number(value) : value;
	if (!Number.isFinite(n) || n === 0) return '';
	return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

export function pct(value: string | number | null | undefined): string {
	if (value === null || value === undefined || value === '') return '';
	const n = typeof value === 'string' ? Number(value) : value;
	if (!Number.isFinite(n) || n === 0) return '';
	return `${(n * 100).toFixed(1)}%`;
}

export function fyLabel(fyStart: number): string {
	return `FY ${fyStart % 100}-${(fyStart + 1) % 100}`;
}
