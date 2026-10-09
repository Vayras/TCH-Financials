import * as React from 'react';
import Tag from '@/components/ui/Tag';
import { type DealDocument } from '@/lib/api';
import { downloadAuthenticatedFile } from '@/lib/download';

export function InvoiceTag({
	label,
	doc,
	fallbackYes
}: {
	label: string;
	doc: DealDocument | undefined;
	fallbackYes: boolean;
}) {
	const yes = !!doc || fallbackYes;
	const tag = (
		<Tag tone={yes ? 'yes' : 'no'} className={doc?.file ? 'cursor-pointer' : undefined}>
			{label}
		</Tag>
	);
	if (doc?.file) {
		return (
			<button type="button" onClick={() => void downloadAuthenticatedFile(doc.file, doc.label || label)} title={doc.label || label}>
				{tag}
			</button>
		);
	}
	return tag;
}
