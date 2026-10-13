import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Card({ className, ...props }, ref) {
	return <div ref={ref} className={cn('rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)]', className)} {...props} />;
});

export default Card;
