'use client';

const DEV_ACCOUNTS = [
	{ email: 'admin.dev@tch.local', label: 'Dev Admin', path: '/' },
	{ email: 'accounts.dev@tch.local', label: 'Dev Accounts', path: '/accounts-dashboard' },
	{ email: 'creator.dev@tch.local', label: 'Dev Creator', path: '/creator-portal' },
] as const;

export default function DevAccountSwitcher({ currentEmail }: { currentEmail: string }) {
	return (
		<details className="dev-tools-panel"><summary>Developer tools</summary><label className="flex items-center gap-2 p-3">
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
		</label></details>
	);
}
