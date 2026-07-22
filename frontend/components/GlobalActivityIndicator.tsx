'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export default function GlobalActivityIndicator() {
	const fetching = useIsFetching();
	const mutating = useIsMutating();
	if (!fetching && !mutating) return null;

	return (
		<>
			<div className="global-progress" role="progressbar" aria-label={mutating ? 'Saving changes' : 'Loading data'}>
				<span />
			</div>
			{mutating > 0 && (
				<div className="mutation-screen" role="status" aria-live="polite">
					<div className="mutation-screen-card">
						<span className="activity-spinner" />
						<div><strong>Saving changes…</strong><span>Please keep this window open.</span></div>
					</div>
				</div>
			)}
		</>
	);
}
