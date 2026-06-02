'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

export interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	children?: React.ReactNode;
	footer?: React.ReactNode;
	className?: string;
}

export function Dialog({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer,
	className
}: DialogProps) {
	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
				<DialogPrimitive.Content
					className={cn(
						'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
						'w-full max-w-2xl rounded-lg p-5',
						'max-h-[90vh] overflow-y-auto',
						className
					)}
					style={{
						background: 'var(--n-bg)',
						border: '1px solid var(--n-border)',
						boxShadow:
							'0 14px 36px rgba(15, 15, 15, 0.16), 0 2px 6px rgba(15, 15, 15, 0.06)'
					}}
				>
					<div
						className="flex items-start justify-between pb-3 mb-4"
						style={{ borderBottom: '1px solid var(--n-border)' }}
					>
						<div>
							<DialogPrimitive.Title
								className="page-title text-[20px] font-semibold"
								style={{ color: 'var(--n-fg)' }}
							>
								{title}
							</DialogPrimitive.Title>
							{description && (
								<DialogPrimitive.Description
									className="text-[13.5px] mt-1"
									style={{ color: 'var(--n-fg-muted)' }}
								>
									{description}
								</DialogPrimitive.Description>
							)}
						</div>
						<DialogPrimitive.Close
							className="h-7 w-7 rounded inline-flex items-center justify-center transition-colors hover:[background:var(--n-bg-hover)]"
							style={{ color: 'var(--n-fg-muted)' }}
							aria-label="Close"
						>
							<Icon name="x" size={16} />
						</DialogPrimitive.Close>
					</div>
					{children}
					{footer && (
						<div
							className="mt-5 flex justify-end gap-2 pt-4"
							style={{ borderTop: '1px solid var(--n-border)' }}
						>
							{footer}
						</div>
					)}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

export default Dialog;
