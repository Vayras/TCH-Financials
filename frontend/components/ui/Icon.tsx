import * as React from 'react';
import * as LucideIcons from 'lucide-react';

// Map the app's existing icon name strings to lucide-react component names.
// Add new entries here as needed.
const NAME_MAP: Record<string, keyof typeof LucideIcons> = {
	home: 'Home',
	briefcase: 'Briefcase',
	users: 'Users',
	'file-signature': 'FileText',
	star: 'Star',
	'user-cog': 'UserCog',
	'log-out': 'LogOut',
	layers: 'Layers',
	search: 'Search',
	'chevron-right': 'ChevronRight',
	'chevron-left': 'ChevronLeft',
	'chevrons-left': 'ChevronsLeft',
	'chevron-down': 'ChevronDown',
	filter: 'Filter',
	plus: 'Plus',
	refresh: 'RefreshCw',
	calendar: 'Calendar',
	'calendar-clock': 'CalendarClock',
	'arrow-right': 'ArrowRight',
	x: 'X',
	check: 'Check',
	'more-horizontal': 'MoreHorizontal',
	sparkle: 'Sparkles',
	sparkles: 'Sparkles',
	bell: 'Bell',
	'alert-triangle': 'AlertTriangle',
	'alert-circle': 'AlertCircle',
	target: 'Target',
	activity: 'Activity',
	download: 'Download',
	'credit-card': 'CreditCard',
	edit: 'Pencil',
	trash: 'Trash2',
	grid: 'LayoutGrid',
	list: 'List',
	inbox: 'Inbox',
	zap: 'Zap',
	'file-text': 'FileText',
	'external-link': 'ExternalLink',
	link: 'Link',
	eye: 'Eye',
	'eye-off': 'EyeOff',
	key: 'Key',
	settings: 'Settings',
	lock: 'Lock',
	mail: 'Mail',
	phone: 'Phone',
	upload: 'Upload',
	'bar-chart': 'BarChart2',
	pie: 'PieChart',
	trending: 'TrendingUp',
	info: 'Info',
	'alert-octagon': 'AlertOctagon',
	copy: 'Copy',
	share: 'Share2',
	'arrow-left': 'ArrowLeft',
	'arrow-up': 'ArrowUp',
	'arrow-down': 'ArrowDown',
	tag: 'Tag',
	clock: 'Clock',
	globe: 'Globe',
	package: 'Package',
};

export interface IconProps {
	name: string;
	className?: string;
	size?: number;
}

export function Icon({ name, className, size = 16 }: IconProps) {
	const lucideName = NAME_MAP[name];
	if (!lucideName) {
		// Unknown icon — render a question mark placeholder in dev, nothing in prod
		if (process.env.NODE_ENV === 'development') {
			return (
				<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden="true">
					<circle cx="12" cy="12" r="10" />
					<path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
					<line x1="12" y1="17" x2="12.01" y2="17" />
				</svg>
			);
		}
		return null;
	}

	const LucideComponent = LucideIcons[lucideName] as React.FC<{ size?: number; className?: string }>;
	return <LucideComponent size={size} className={className} />;
}

export default Icon;
