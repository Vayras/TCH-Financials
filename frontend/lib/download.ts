import { httpClient } from './axios';

export async function downloadAuthenticatedFile(url: string, fallbackName = 'download'): Promise<void> {
	const response = await httpClient.get<Blob>(url, { responseType: 'blob' });
	const disposition = String(response.headers['content-disposition'] ?? '');
	const match = disposition.match(/filename="?([^";]+)"?/i);
	const filename = match?.[1] || fallbackName;
	const objectUrl = URL.createObjectURL(response.data);
	const anchor = document.createElement('a');
	anchor.href = objectUrl;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(objectUrl);
}
