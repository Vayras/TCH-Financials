import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
	value: string;
	label: string;
}

export interface SelectProps
	extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
	options: SelectOption[];
	placeholder?: string;
}

const chevron =
	"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2337352f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")";

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
	{ className, options, placeholder, style, ...rest },
	ref
) {
	return (
		<select
			ref={ref}
			className={cn(
				'h-8 w-full rounded px-2 pr-7 text-[14px]',
				'bg-[var(--n-bg-soft)] text-[var(--n-fg)]',
				'border border-[var(--n-border)] hover:border-[var(--n-border-strong)]',
				'focus:outline-none focus:border-[var(--n-accent)]',
				'appearance-none transition-colors',
				'bg-no-repeat',
				className
			)}
			style={{
				backgroundImage: chevron,
				backgroundPosition: 'right 8px center',
				backgroundSize: '12px 12px',
				...style
			}}
			{...rest}
		>
			{placeholder !== undefined && <option value="">{placeholder}</option>}
			{options.map((opt) => (
				<option key={opt.value} value={opt.value}>
					{opt.label}
				</option>
			))}
		</select>
	);
});

export default Select;
