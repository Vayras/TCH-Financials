import * as React from 'react';
import { cn } from '@/lib/utils';

type Tone =
	| 'neutral'
	| 'inbound'
	| 'outbound'
	| 'markup'
	| 'yes'
	| 'no'
	| 'exclusive'
	| 'friend'
	| 'dropping'
	| 'nontch'
	| 'emw'
	| 'accent';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
	tone?: Tone;
}

const TONES: Record<Tone, string> = {
	neutral:  'bg-[#e9e9e7] text-[#37352f]',
	inbound:  'bg-[var(--color-inbound-bg)] text-[var(--color-inbound)]',
	outbound: 'bg-[var(--color-outbound-bg)] text-[var(--color-outbound)]',
	markup:   'bg-[#fce5cd] text-[#9a4d22]',
	yes:      'bg-[var(--color-success-bg)] text-[var(--color-success)]',
	no:       'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
	exclusive:'bg-[var(--n-accent-soft)] text-[var(--n-accent)]',
	friend:   'bg-[#e9e9e7] text-[#37352f]',
	dropping: 'bg-[#fce5cd] text-[#9a4d22]',
	nontch:   'bg-[#ebeced] text-[#5b6269]',
	emw:      'bg-[var(--n-accent-soft)] text-[var(--n-accent)]',
	accent:   'bg-[var(--color-outbound-bg)] text-[var(--color-outbound)]'
};

export function Tag({ tone = 'neutral', className, children, ...rest }: TagProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center px-1.5 h-5 text-[11px] font-medium rounded-[3px] whitespace-nowrap',
				TONES[tone],
				className
			)}
			{...rest}
		>
			{children}
		</span>
	);
}

export default Tag;
