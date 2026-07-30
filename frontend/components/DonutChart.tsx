import React, { useState } from 'react';

export function DonutChart({ emw, external }: { emw: number, external: number }) {
	const [hovered, setHovered] = useState<'emw' | 'ext' | null>(null);
	const total = emw + external;
	const emwPct = total === 0 ? 0 : (emw / total) * 100;
	const extPct = total === 0 ? 0 : (external / total) * 100;
	const r = 38;
	const c = 2 * Math.PI * r;
	const emwDash = (emwPct / 100) * c;

	const formatAmount = (val: number) => {
		if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
		if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
		if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
		return `₹${val}`;
	};
	
	return (
		<div className="rounded-2xl p-5 h-full flex flex-col items-center justify-center gap-4" style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}>
			<h3 className="text-[13px] font-semibold text-gray-800 self-start w-full tracking-wide">Revenue Split</h3>
			<div className="relative w-[160px] h-[160px] flex-shrink-0 flex items-center justify-center">
				<svg viewBox="0 0 100 100" className="absolute inset-0 transform -rotate-90 w-full h-full">
					<circle 
						cx="50" cy="50" r={r} fill="transparent" stroke="#e5e7eb" 
						onMouseEnter={() => setHovered('ext')} onMouseLeave={() => setHovered(null)}
						style={{ transition: 'stroke-width 0.2s', strokeWidth: hovered === 'ext' ? 14 : 12, cursor: 'pointer' }}
					/>
					<circle 
						cx="50" cy="50" r={r} fill="transparent" stroke="#1a63a3" strokeDasharray={`${emwDash} ${c}`} strokeLinecap="round" 
						onMouseEnter={() => setHovered('emw')} onMouseLeave={() => setHovered(null)}
						style={{ transition: 'stroke-width 0.2s', strokeWidth: hovered === 'emw' ? 14 : 12, cursor: 'pointer' }}
					/>
				</svg>
				<div className="flex flex-col items-center justify-center z-10 text-center pointer-events-none transition-opacity duration-200">
					{hovered === 'emw' ? (
						<>
							<span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">EMW</span>
							<span className="text-[13px] font-bold text-[#1a63a3] tabular-nums">{formatAmount(emw)}</span>
							<span className="text-[10px] text-gray-400">{emwPct.toFixed(1)}%</span>
						</>
					) : hovered === 'ext' ? (
						<>
							<span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">External</span>
							<span className="text-[13px] font-bold text-gray-700 tabular-nums">{formatAmount(external)}</span>
							<span className="text-[10px] text-gray-400">{extPct.toFixed(1)}%</span>
						</>
					) : (
						<>
							<span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Total</span>
							<span className="text-[14px] font-bold text-gray-900 tabular-nums">{formatAmount(total)}</span>
						</>
					)}
				</div>
			</div>
			<div className="flex gap-5 text-[12.5px] font-medium mt-1 text-gray-700">
				<div 
					className="flex items-center gap-2 cursor-pointer"
					onMouseEnter={() => setHovered('emw')} onMouseLeave={() => setHovered(null)}
				>
					<div className={`w-2.5 h-2.5 rounded-full bg-[#1a63a3] transition-transform ${hovered === 'emw' ? 'scale-125' : ''}`} /> EMW
				</div>
				<div 
					className="flex items-center gap-2 cursor-pointer"
					onMouseEnter={() => setHovered('ext')} onMouseLeave={() => setHovered(null)}
				>
					<div className={`w-2.5 h-2.5 rounded-full bg-[#e5e7eb] border border-gray-200 transition-transform ${hovered === 'ext' ? 'scale-125' : ''}`} /> External
				</div>
			</div>
		</div>
	);
}
