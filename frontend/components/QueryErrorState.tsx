import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';

export default function QueryErrorState({
	title = 'We couldn’t load this data',
	description = 'Please check your connection and try again.',
	onRetry
}: {
	title?: string;
	description?: string;
	onRetry?: () => void;
}) {
	return (
		<div className="query-error-state" role="alert">
			<div className="query-error-icon"><Icon name="alert-circle" size={18} /></div>
			<div className="min-w-0 flex-1">
				<div className="text-[14px] font-semibold">{title}</div>
				<div className="text-[13px] mt-0.5">{description}</div>
			</div>
			{onRetry && <Button variant="outline" onClick={onRetry}><Icon name="refresh" size={13} /> Retry</Button>}
		</div>
	);
}
