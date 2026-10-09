'use client';

import Dialog from './Dialog';
import Button from './Button';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = 'Confirm',
	confirmVariant = 'primary',
	onConfirm,
	pending = false
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	confirmLabel?: string;
	confirmVariant?: 'primary' | 'danger';
	onConfirm: () => void | Promise<void>;
	pending?: boolean;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			className={`max-w-md ${styles.dialog}`}
			footer={
				<>
					<Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button type="button" variant={confirmVariant} disabled={pending} onClick={() => void onConfirm()}>
						{pending ? 'Please wait…' : confirmLabel}
					</Button>
				</>
			}
		>
		</Dialog>
	);
}
