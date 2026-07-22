import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
}

const base =
	'inline-flex items-center justify-center font-medium rounded transition-[background-color,color,border-color,box-shadow] duration-100 select-none disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
	primary:
		'border border-transparent bg-[var(--n-accent)] text-white hover:bg-[#380e44] shadow-[0_1px_2px_rgba(15,15,15,0.1)]',
	outline:
		'border border-[var(--n-border-strong)] bg-transparent text-[var(--n-fg)] hover:bg-[var(--n-bg-hover)]',
	ghost:
		'border border-transparent bg-transparent text-[var(--n-fg-muted)] hover:bg-[var(--n-bg-hover)] hover:text-[var(--n-fg)]',
	danger:
		'border border-[var(--color-danger-border)] bg-transparent text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] hover:border-[var(--color-danger-border)]'
};

const sizes: Record<Size, string> = {
	sm: 'h-7 px-2.5 text-[13px] gap-1.5',
	md: 'h-8 px-3 text-[14px] gap-2'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ variant = 'outline', size = 'sm', className, type, children, ...rest },
	ref
) {
	return (
		<button
			ref={ref}
			type={type ?? 'button'}
			className={cn(base, variants[variant], sizes[size], className)}
			{...rest}
		>
			{children}
		</button>
	);
});

export default Button;
