import React from 'react';

// Format amounts nicely
const inr = (n: number) => {
	if (n >= 1e7) return `${+(n / 1e7).toFixed(2)}Cr`;
	if (n >= 1e5) return `${+(n / 1e5).toFixed(2)}L`;
	if (n >= 1e3) return `${+(n / 1e3).toFixed(0)}K`;
	return String(n);
};

export function TopList({ title, items }: { title: string, items: { name: string, total: string }[] }) {
	const max = items.length > 0 ? Number(items[0].total) : 1;
	return (
		<div className="rounded-2xl p-5 h-full flex flex-col" style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
			<h3 className="text-[13px] font-semibold text-gray-800 mb-6 tracking-wide">{title}</h3>
			<div className="flex-1 flex flex-col justify-center gap-4">
				{items.length === 0 && (
					<div className="text-[13px] italic text-gray-400">No data available.</div>
				)}
				{items.map((item, i) => {
					const val = Number(item.total);
					const pct = max > 0 ? (val / max) * 100 : 0;
					return (
						<div key={i} className="relative group">
							<div className="flex justify-between items-baseline text-[13px] mb-2 z-10 relative">
								<span className="font-medium truncate pr-2 text-gray-800 group-hover:text-gray-900 transition-colors">{item.name || '(Unknown)'}</span>
								<span className="tabular-nums font-semibold text-gray-600">₹{inr(val)}</span>
							</div>
							<div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
								<div 
									className="h-full rounded-full transition-all duration-1000 ease-out" 
									style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #374151 0%, #111827 100%)' }} 
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
