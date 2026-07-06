'use client';

import * as React from 'react';
import { inr, pct } from '@/lib/utils';

// Monthly/quarterly billing chart for the Overview page. Each period gets a
// stacked billing column — Elements (EMW) below, External above, so the stack
// height is Total Billing — with a Profit column beside it (same ₹ axis).
// Colors are validated against the dataviz checks: blue/green pass all six;
// the External gray is deliberately neutral (context, not identity) and its
// sub-3:1 contrast is relieved by the legend, tooltip, and the campaign table.
const C_EMW = '#1a63a3';
const C_EXTERNAL = '#9b9a97';
const C_PROFIT = '#0d9070';

const W = 960;
const H = 300;
const M = { top: 16, right: 12, bottom: 28, left: 56 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;
const BAR_MAX = 24; // marks stay thin; the band's leftover is air
const GAP = 2; // surface gap between touching marks

export interface BillingBarChartProps {
	cols: { key: string; label: string }[];
	totals: Record<string, string>;
	emw: Record<string, string>;
	profits: Record<string, string>;
	emwPct: Record<string, string>;
	profitPct: Record<string, string>;
}

const num = (v: string | undefined) => {
	const n = Number(v ?? 0);
	return Number.isFinite(n) ? n : 0;
};

// Axis ticks in compact Indian units: 1.2Cr / 45L / 80K.
function compactInr(n: number): string {
	if (n === 0) return '0';
	if (n >= 1e7) return `${+(n / 1e7).toFixed(1)}Cr`;
	if (n >= 1e5) return `${+(n / 1e5).toFixed(1)}L`;
	if (n >= 1e3) return `${+(n / 1e3).toFixed(0)}K`;
	return String(n);
}

// Round the axis max up to a clean step so ticks land on round numbers.
function niceMax(n: number): number {
	if (n <= 0) return 1;
	const pow = 10 ** Math.floor(Math.log10(n));
	for (const m of [1, 2, 2.5, 5, 10]) {
		if (n <= m * pow) return m * pow;
	}
	return 10 * pow;
}

function shortLabel(label: string, key: string): string {
	if (key.startsWith('Q')) return key; // "Q1 (Apr-Jun)" -> "Q1"
	const [mon, year] = label.split(' ');
	return year ? `${mon} ${year.slice(2)}` : label; // "Apr 2026" -> "Apr 26"
}

export default function BillingBarChart({
	cols,
	totals,
	emw,
	profits,
	emwPct,
	profitPct
}: BillingBarChartProps) {
	const [hover, setHover] = React.useState<number | null>(null);

	const rows = cols.map((c) => {
		const total = num(totals[c.key]);
		const emwV = Math.min(num(emw[c.key]), total);
		return {
			key: c.key,
			label: c.label,
			total,
			emw: emwV,
			external: Math.max(total - emwV, 0),
			profit: num(profits[c.key]),
			emwPct: emwPct[c.key],
			profitPct: profitPct[c.key]
		};
	});

	const dataMax = Math.max(...rows.map((r) => Math.max(r.total, r.profit)), 0);
	if (dataMax === 0) {
		return (
			<div
				className="rounded p-8 text-center text-[13.5px]"
				style={{ border: '1px dashed var(--n-border)', color: 'var(--n-fg-subtle)' }}
			>
				No invoiced billing in this period yet — add deals with an E-Invoice No and the chart
				fills in.
			</div>
		);
	}

	const yMax = niceMax(dataMax);
	const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
	const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;

	const band = PLOT_W / rows.length;
	const barW = Math.min(BAR_MAX, Math.max(6, (band - 3 * GAP) / 2 - 4));
	const pairW = barW * 2 + GAP;

	const hovered = hover !== null ? rows[hover] : null;
	const hoverCenterPct =
		hover !== null ? ((M.left + band * hover + band / 2) / W) * 100 : 0;

	return (
		<div className="relative">
			{/* Legend — identity never rides on color alone */}
			<div
				className="flex flex-wrap items-center gap-4 mb-2 text-[12.5px]"
				style={{ color: 'var(--n-fg-muted)' }}
			>
				{(
					[
						['Elements (EMW)', C_EMW],
						['External', C_EXTERNAL],
						['Profit (TCH Fee)', C_PROFIT]
					] as const
				).map(([label, color]) => (
					<span key={label} className="inline-flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
						{label}
					</span>
				))}
				<span className="ml-auto text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
					Billing stack + profit, per {rows[0]?.key.startsWith('Q') ? 'quarter' : 'month'}
				</span>
			</div>

			<svg
				viewBox={`0 0 ${W} ${H}`}
				width="100%"
				role="img"
				aria-label="Billing and profit by period"
				onMouseLeave={() => setHover(null)}
			>
				{/* gridlines + y ticks */}
				{ticks.map((t) => (
					<g key={t}>
						<line
							x1={M.left}
							x2={W - M.right}
							y1={y(t)}
							y2={y(t)}
							stroke="rgba(55,53,47,0.09)"
							strokeWidth="1"
						/>
						<text
							x={M.left - 8}
							y={y(t) + 3.5}
							textAnchor="end"
							fontSize="11"
							style={{ fill: 'var(--n-fg-subtle)', fontVariantNumeric: 'tabular-nums' }}
						>
							{compactInr(t)}
						</text>
					</g>
				))}

				{rows.map((r, i) => {
					const x0 = M.left + band * i + (band - pairW) / 2;
					const bx = x0; // billing stack
					const px = x0 + barW + GAP; // profit column
					const yTotal = y(r.total);
					const yEmwTop = y(r.emw);
					const emwH = Math.max(M.top + PLOT_H - yEmwTop, 0);
					const extH = Math.max(yEmwTop - yTotal - (r.emw > 0 && r.external > 0 ? GAP : 0), 0);
					const profitH = Math.max(M.top + PLOT_H - y(r.profit), 0);
					const dim = hover !== null && hover !== i ? 0.45 : 1;
					return (
						<g key={r.key} opacity={dim}>
							{hover === i && (
								<rect
									x={M.left + band * i}
									y={M.top}
									width={band}
									height={PLOT_H}
									fill="rgba(55,53,47,0.04)"
								/>
							)}
							{/* External — top of the stack, rounded data-end */}
							{r.external > 0 && (
								<path
									d={roundedTopBar(bx, yTotal, barW, extH)}
									fill={C_EXTERNAL}
								/>
							)}
							{/* EMW — base of the stack; rounded only when it IS the top */}
							{r.emw > 0 &&
								(r.external > 0 ? (
									<rect x={bx} y={yEmwTop} width={barW} height={emwH} fill={C_EMW} />
								) : (
									<path d={roundedTopBar(bx, yEmwTop, barW, emwH)} fill={C_EMW} />
								))}
							{/* Profit */}
							{r.profit > 0 && (
								<path d={roundedTopBar(px, y(r.profit), barW, profitH)} fill={C_PROFIT} />
							)}
							{/* x label */}
							<text
								x={M.left + band * i + band / 2}
								y={H - 8}
								textAnchor="middle"
								fontSize="11"
								style={{ fill: 'var(--n-fg-subtle)' }}
							>
								{shortLabel(r.label, r.key)}
							</text>
							{/* band-wide hover target */}
							<rect
								x={M.left + band * i}
								y={M.top}
								width={band}
								height={PLOT_H}
								fill="transparent"
								onMouseEnter={() => setHover(i)}
							/>
						</g>
					);
				})}

				{/* baseline */}
				<line
					x1={M.left}
					x2={W - M.right}
					y1={M.top + PLOT_H}
					y2={M.top + PLOT_H}
					stroke="rgba(55,53,47,0.2)"
					strokeWidth="1"
				/>
			</svg>

			{hovered && (
				<div
					className="absolute z-10 rounded p-2.5 text-[12.5px] shadow-md pointer-events-none"
					style={{
						top: 24,
						left: `${Math.min(Math.max(hoverCenterPct, 12), 88)}%`,
						transform: 'translateX(-50%)',
						background: 'var(--n-bg)',
						border: '1px solid var(--n-border)',
						minWidth: 190
					}}
				>
					<div className="font-medium mb-1" style={{ color: 'var(--n-fg)' }}>
						{hovered.label}
					</div>
					<TooltipRow color="var(--n-fg)" label="Total Billing" value={`₹ ${inr(hovered.total) || '0'}`} bold />
					<TooltipRow
						color={C_EMW}
						label="Elements (EMW)"
						value={`₹ ${inr(hovered.emw) || '0'}${hovered.emwPct && pct(hovered.emwPct) ? ` · ${pct(hovered.emwPct)}` : ''}`}
					/>
					<TooltipRow color={C_EXTERNAL} label="External" value={`₹ ${inr(hovered.external) || '0'}`} />
					<TooltipRow
						color={C_PROFIT}
						label="Profit (TCH Fee)"
						value={`₹ ${inr(hovered.profit) || '0'}${hovered.profitPct && pct(hovered.profitPct) ? ` · ${pct(hovered.profitPct)} margin` : ''}`}
					/>
				</div>
			)}
		</div>
	);
}

// A column with a 4px rounded data-end and a square baseline end.
function roundedTopBar(x: number, yTop: number, w: number, h: number): string {
	if (h <= 0) return '';
	const r = Math.min(4, h, w / 2);
	return [
		`M ${x} ${yTop + h}`,
		`L ${x} ${yTop + r}`,
		`Q ${x} ${yTop} ${x + r} ${yTop}`,
		`L ${x + w - r} ${yTop}`,
		`Q ${x + w} ${yTop} ${x + w} ${yTop + r}`,
		`L ${x + w} ${yTop + h}`,
		'Z'
	].join(' ');
}

function TooltipRow({
	color,
	label,
	value,
	bold
}: {
	color: string;
	label: string;
	value: string;
	bold?: boolean;
}) {
	return (
		<div className="flex items-center gap-1.5 py-0.5">
			<span className="h-2 w-2 rounded-[2px] shrink-0" style={{ background: color }} />
			<span style={{ color: 'var(--n-fg-muted)' }}>{label}</span>
			<span
				className={`ml-auto tabular-nums ${bold ? 'font-semibold' : ''}`}
				style={{ color: 'var(--n-fg)' }}
			>
				{value}
			</span>
		</div>
	);
}
