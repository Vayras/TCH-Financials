import type { CreatorDocument } from './api';

// Force a save-to-disk. Files are served cross-origin (API host), so the
// <a download> attribute is ignored — fetch as a blob and download that.
export async function downloadDocument(d: CreatorDocument): Promise<void> {
	const res = await fetch(d.file);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = d.label || d.file.split('/').pop() || 'document';
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
