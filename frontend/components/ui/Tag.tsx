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
	neutral: 'bg-[#e9e9e7] text-[#37352f]',
	inbound: 'bg-[#dcedda] text-[#1f6f43]',
	outbound: 'bg-[#dde8f6] text-[#19567c]',
	markup: 'bg-[#fce5cd] text-[#9a4d22]',
	yes: 'bg-[#dcedda] text-[#1f6f43]',
	no: 'bg-[#fadcd6] text-[#a4231b]',
	exclusive: 'bg-[#e6dbf6] text-[#52298f]',
	friend: 'bg-[#e9e9e7] text-[#37352f]',
	dropping: 'bg-[#fce5cd] text-[#9a4d22]',
	nontch: 'bg-[#ebeced] text-[#5b6269]',
	emw: 'bg-[#e6dbf6] text-[#52298f]',
	accent: 'bg-[#dde8f6] text-[#19567c]'
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
