'use client';

const DEV_ACCOUNTS = [
	{ email: 'admin.dev@tch.local', label: 'Dev Admin', path: '/' },
	{ email: 'accounts.dev@tch.local', label: 'Dev Accounts', path: '/accounts-dashboard' },
	{ email: 'creator.dev@tch.local', label: 'Dev Creator', path: '/creator-portal' },
] as const;

export default function DevAccountSwitcher({ currentEmail }: { currentEmail: string }) {
	return (
		<label className="fixed bottom-3 left-3 right-3 z-50 flex items-center justify-between rounded-md border bg-white px-3 py-2 text-xs shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:justify-start">
			<span className="mr-2 font-semibold">Dev account</span>
			<select
				value={currentEmail}
				onChange={(event) => {
					const account = DEV_ACCOUNTS.find((item) => item.email === event.target.value);
					if (!account) return;
					window.localStorage.setItem('tch-dev-user', account.email);
					window.location.assign(account.path);
				}}
				className="min-w-0 rounded border px-2 py-1"
				aria-label="Development account"
			>
				{DEV_ACCOUNTS.map((account) => (
					<option key={account.email} value={account.email}>{account.label}</option>
				))}
			</select>
		</label>
	);
}
