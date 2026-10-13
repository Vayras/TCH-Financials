import * as React from 'react';
import { cn } from '@/lib/utils';

export function Tabs({ items, value, onChange, className }: { items: { value: string; label: string }[]; value: string; onChange: (value: string) => void; className?: string }) {
	return <div role="tablist" className={cn('flex gap-1 border-b border-[var(--app-border)]', className)}>{items.map(item => <button key={item.value} type="button" role="tab" aria-selected={value === item.value} onClick={() => onChange(item.value)} className={cn('border-b-2 px-3 py-2 text-sm text-[var(--app-muted)]', value === item.value ? 'border-[var(--app-brand)] font-medium text-[var(--app-fg)]' : 'border-transparent')}>{item.label}</button>)}</div>;
}

export default Tabs;
