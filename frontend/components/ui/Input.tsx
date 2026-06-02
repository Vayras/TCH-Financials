import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
	{ className, ...rest },
	ref
) {
	return (
		<input
			ref={ref}
			className={cn(
				'h-8 w-full rounded px-2 text-[14px] tabular-nums',
				'bg-[var(--n-bg-soft)] text-[var(--n-fg)]',
				'border border-[var(--n-border)] hover:border-[var(--n-border-strong)]',
				'focus:outline-none focus:border-[var(--n-accent)]',
				'transition-colors',
				'placeholder:text-[var(--n-fg-subtle)]',
				className
			)}
			{...rest}
		/>
	);
});

export default Input;
