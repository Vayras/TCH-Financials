import { type AlertsPayload } from '@/lib/api';

export type EmployeeForm = {
	week_ending: string;
	employee_name: string;
	new_outreach: number;
	paid_confirmations: string;
	revenue_locked: string;
	profit_locked: string;
	barter_confirmations: string;
	live_campaigns: number;
	action_points: string;
};

export type AlertsState =
	| { kind: 'loading' }
	| { kind: 'error'; message: string }
	| { kind: 'ok'; data: AlertsPayload };

export type AlertSectionKey = 'urgent' | 'payments' | 'bd' | 'health' | 'docs' | 'seasonal';
export type AlertFilterKey = 'all' | AlertSectionKey;
