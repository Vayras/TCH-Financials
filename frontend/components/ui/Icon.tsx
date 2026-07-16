import * as React from 'react';

const PATHS: Record<string, React.ReactNode> = {
	home: (
		<>
			<path d="M3 9.5L12 3l9 6.5" />
			<path d="M5 9v11h14V9" />
		</>
	),
	briefcase: (
		<>
			<rect x="3" y="7" width="18" height="13" rx="2" />
			<path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
			<path d="M3 13h18" />
		</>
	),
	users: (
		<>
			<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M22 21v-2a4 4 0 00-3-3.87" />
			<path d="M16 3.13a4 4 0 010 7.75" />
		</>
	),
	'file-signature': (
		<>
			<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
			<path d="M14 3v6h6" />
			<path d="M8 17l8-8" />
		</>
	),
	star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />,
	'user-cog': (
		<>
			<circle cx="9" cy="7" r="4" />
			<path d="M3 21v-2a4 4 0 014-4h4" />
			<circle cx="18" cy="15" r="3" />
			<path d="M18 11v1m0 6v1m4-4h-1m-6 0h-1" />
		</>
	),
	'log-out': (
		<>
			<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
			<path d="M16 17l5-5-5-5" />
			<path d="M21 12H9" />
		</>
	),
	layers: (
		<>
			<polygon points="12 2 2 7 12 12 22 7 12 2" />
			<polyline points="2 17 12 22 22 17" />
			<polyline points="2 12 12 17 22 12" />
		</>
	),
	search: (
		<>
			<circle cx="11" cy="11" r="7" />
			<path d="M21 21l-4.3-4.3" />
		</>
	),
	'chevron-right': <polyline points="9 6 15 12 9 18" />,
	'chevron-left': <polyline points="15 6 9 12 15 18" />,
	'chevrons-left': (
		<>
			<polyline points="11 17 6 12 11 7" />
			<polyline points="18 17 13 12 18 7" />
		</>
	),
	filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
	plus: (
		<>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</>
	),
	refresh: (
		<>
			<polyline points="23 4 23 10 17 10" />
			<polyline points="1 20 1 14 7 14" />
			<path d="M3.51 9a9 9 0 0114.85-3.36L23 10" />
			<path d="M20.49 15A9 9 0 015.64 18.36L1 14" />
		</>
	),
	calendar: (
		<>
			<rect x="3" y="4" width="18" height="18" rx="2" />
			<line x1="16" y1="2" x2="16" y2="6" />
			<line x1="8" y1="2" x2="8" y2="6" />
			<line x1="3" y1="10" x2="21" y2="10" />
		</>
	),
	'arrow-right': (
		<>
			<line x1="5" y1="12" x2="19" y2="12" />
			<polyline points="12 5 19 12 12 19" />
		</>
	),
	x: (
		<>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</>
	),
	check: <polyline points="20 6 9 17 4 12" />,
	'more-horizontal': (
		<>
			<circle cx="12" cy="12" r="1" />
			<circle cx="19" cy="12" r="1" />
			<circle cx="5" cy="12" r="1" />
		</>
	),
	sparkle: (
		<>
			<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
			<path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7L19 14z" />
		</>
	),
	bell: (
		<>
			<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
			<path d="M13.73 21a2 2 0 01-3.46 0" />
		</>
	),
	'alert-triangle': (
		<>
			<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
			<line x1="12" y1="9" x2="12" y2="13" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</>
	),
	target: (
		<>
			<circle cx="12" cy="12" r="10" />
			<circle cx="12" cy="12" r="6" />
			<circle cx="12" cy="12" r="2" />
		</>
	),
	activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
	download: (
		<>
			<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</>
	),
	'credit-card': (
		<>
			<rect x="2" y="5" width="20" height="14" rx="2" />
			<line x1="2" y1="10" x2="22" y2="10" />
			<line x1="6" y1="15" x2="10" y2="15" />
		</>
	),
	'calendar-clock': (
		<>
			<rect x="3" y="4" width="13" height="18" rx="2" />
			<line x1="16" y1="2" x2="16" y2="6" />
			<line x1="8" y1="2" x2="8" y2="6" />
			<line x1="3" y1="10" x2="16" y2="10" />
			<circle cx="18" cy="16" r="4" />
			<path d="M18 14v2l1 1" />
		</>
	),
	edit: (
		<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
	),
	trash: (
		<>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
			<line x1="10" y1="11" x2="10" y2="17" />
			<line x1="14" y1="11" x2="14" y2="17" />
		</>
	)

};

export interface IconProps {
	name: string;
	className?: string;
	size?: number;
}

export function Icon({ name, className, size = 16 }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.75}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			{PATHS[name] ?? null}
		</svg>
	);
}

export default Icon;
