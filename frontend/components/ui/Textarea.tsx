import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
	{ className, ...rest },
	ref
) {
	return (
		<textarea
			ref={ref}
			className={cn(
				'min-h-[72px] w-full rounded px-2 py-1.5 text-[14px]',
				'bg-[var(--n-bg-soft)] text-[var(--n-fg)]',
				'border border-[var(--n-border)] hover:border-[var(--n-border-strong)]',
				'focus:outline-none focus:border-[var(--n-accent)]',
				'transition-colors resize-y',
				'placeholder:text-[var(--n-fg-subtle)]',
				className
			)}
			{...rest}
		/>
	);
});

export default Textarea;
