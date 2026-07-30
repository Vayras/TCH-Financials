import React, { useState } from 'react';

// Format amounts nicely
const inr = (n: number) => {
	if (n >= 1e7) return `${+(n / 1e7).toFixed(2)}Cr`;
	if (n >= 1e5) return `${+(n / 1e5).toFixed(2)}L`;
	if (n >= 1e3) return `${+(n / 1e3).toFixed(0)}K`;
	return String(n);
};

export function TrajectoryAreaChart({ cols, totals }: { cols: {key: string, label: string}[], totals: Record<string, string> }) {
	const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

	if (cols.length === 0) return null;
	const values = cols.map(c => Number(totals[c.key] || 0));
	const cumulative = values.reduce((acc, val) => {
		const last = acc.length > 0 ? acc[acc.length - 1] : 0;
		acc.push(last + val);
		return acc;
	}, [] as number[]);
	
	const max = Math.max(...cumulative, 1) * 1.1; // Add 10% headroom
	const points = cumulative.map((v, i) => {
		const x = (i / Math.max(1, cols.length - 1)) * 100;
		const y = 100 - (v / max) * 100;
		return `${x},${y}`;
	});
	
	const pathData = `M 0,100 L ${points.join(' L ')} L 100,100 Z`;
	const lineData = `M ${points.join(' L ')}`;

	const displayVal = hoveredIdx !== null ? cumulative[hoveredIdx] : 0;

	return (
		<div className="rounded-2xl p-5 h-full flex flex-col" style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}>
			<div className="flex justify-between items-center mb-6 min-h-[40px]">
				<div>
					<h3 className="text-[13px] font-semibold text-gray-800 tracking-wide mb-1">Total Revenue (YTD)</h3>
					<p className="text-[11px] text-gray-500">Cumulative revenue growth</p>
				</div>
				<div className="text-right">
					<span className="text-[16px] font-bold text-gray-900 tabular-nums">₹{inr(cumulative[cumulative.length - 1] || 0)}</span>
				</div>
			</div>
			
			<div className="flex-1 relative w-full min-h-[160px] flex">
				{/* Y Axis Labels */}
				<div className="w-12 h-full flex flex-col justify-between items-end pr-3 pb-[20px] text-[10px] text-gray-400 tabular-nums">
					<span>₹{inr(max)}</span>
					<span>₹{inr(max * 0.5)}</span>
					<span>₹0</span>
				</div>
				
				<div className="flex-1 relative">
					{/* Grid lines */}
					<div className="absolute inset-0 border-b border-l border-gray-100 pb-[20px] pointer-events-none">
						<div className="absolute w-full h-[1px] bg-gray-100 top-0"></div>
						<div className="absolute w-full h-[1px] bg-gray-100 top-1/2"></div>
					</div>
					
					{/* SVG Area */}
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-[calc(100%-20px)] overflow-visible pointer-events-none z-10">
						<defs>
							<linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#1a63a3" stopOpacity="0.25" />
								<stop offset="100%" stopColor="#1a63a3" stopOpacity="0" />
							</linearGradient>
						</defs>
						<path d={pathData} fill="url(#area-grad)" />
						<path d={lineData} fill="none" stroke="#1a63a3" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
						
						{/* Hover Indicator Drop Line */}
						{hoveredIdx !== null && (
							<line
								x1={(hoveredIdx / Math.max(1, cols.length - 1)) * 100}
								y1={100 - (displayVal / max) * 100}
								x2={(hoveredIdx / Math.max(1, cols.length - 1)) * 100}
								y2="100"
								stroke="#1a63a3"
								strokeWidth="1"
								strokeDasharray="2,2"
								vectorEffect="non-scaling-stroke"
								opacity="0.5"
							/>
						)}

						{/* Hover Indicator Dot */}
						{hoveredIdx !== null && (
							<circle 
								cx={(hoveredIdx / Math.max(1, cols.length - 1)) * 100} 
								cy={100 - (displayVal / max) * 100} 
								r="3" 
								fill="#fff" 
								stroke="#1a63a3" 
								strokeWidth="1.5"
								vectorEffect="non-scaling-stroke"
							/>
						)}
					</svg>

					{/* Hover Tooltip Overlay */}
					{hoveredIdx !== null && (
						<div 
							className="absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-full pb-2 transition-all duration-75"
							style={{ 
								left: `${(hoveredIdx / Math.max(1, cols.length - 1)) * 100}%`,
								top: `${100 - (displayVal / max) * 100}%`
							}}
						>
							<div className="bg-white text-gray-800 border border-gray-200 py-1.5 px-3 rounded-lg flex flex-col items-center">
								<span className="font-bold text-[12px] tabular-nums whitespace-nowrap">₹{inr(displayVal)}</span>
								<span className="text-gray-500 font-medium text-[10px] whitespace-nowrap">{cols[hoveredIdx].key.replace(' ', ' - ')}</span>
							</div>
						</div>
					)}

					{/* Interactive Overlay */}
					<div className="absolute inset-0 w-full h-[calc(100%-20px)] flex z-20">
						{cols.map((c, i) => (
							<div 
								key={i} 
								className="flex-1 h-full cursor-pointer" 
								onMouseEnter={() => setHoveredIdx(i)} 
								onMouseLeave={() => setHoveredIdx(null)} 
							/>
						))}
					</div>
					
					{/* X Axis Labels */}
					<div className="absolute bottom-0 left-0 right-0 h-[20px] flex justify-between items-end text-[10px] text-gray-400">
						{cols.map((c, i) => {
							// Only show some labels if there are many
							if (cols.length > 6 && i % 2 !== 0 && i !== cols.length - 1) return <span key={i} style={{width: 0}}></span>;
							return <span key={c.key} className={`truncate px-1 text-center transition-colors duration-200 ${hoveredIdx === i ? 'text-gray-800 font-semibold' : ''}`} style={{ width: `${100/cols.length}%`}}>{c.key.replace(' ', ' - ')}</span>
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
