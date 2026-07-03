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

export function formatDocDate(s: string): string {
	const d = new Date(s);
	return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function formatDoj(s: string | null): string {
	if (!s) return '—';
	return formatDocDate(s);
}

// Force a save-to-disk. Files served cross-origin ignore the <a download>
// attribute, so fetch as a blob and download that. Throws on HTTP errors.
export async function downloadFile(url: string, filename?: string): Promise<void> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	const blob = await res.blob();
	const objectUrl = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = objectUrl;
	a.download = filename || url.split('/').pop() || 'download';
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(objectUrl);
}
