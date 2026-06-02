import * as React from 'react';
import { cn } from '@/lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, children, ...rest }: LabelProps) {
	return (
		<label
			className={cn('block text-[12px] font-medium mb-1.5 text-[var(--n-fg-muted)]', className)}
			{...rest}
		>
			{children}
		</label>
	);
}

export default Label;
