'use client';

import * as React from 'react';

export interface MetricCardProps {
	label: string;
	value: React.ReactNode;
	dotColor?: string;
	valueColor?: string;
}

export function MetricCard({ label, value, dotColor, valueColor }: MetricCardProps) {
	return (
		<div
			className="rounded p-3"
			style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
		>
			<div className="flex items-center gap-1.5">
				{dotColor && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />}
				<div
					className="text-[11.5px] font-medium uppercase leading-[1.2]"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
				>
					{label}
				</div>
			</div>
			<div
				className="mt-1 text-[22px] font-semibold tabular-nums leading-[1.25]"
				style={{ color: valueColor ?? 'var(--n-fg)' }}
			>
				{value}
			</div>
		</div>
	);
}

export default MetricCard;
