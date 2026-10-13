'use client';
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export function Drawer({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode }) {
	return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30" /><DialogPrimitive.Content className={cn('fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto border-l border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-xl')}><DialogPrimitive.Title className="text-base font-medium text-[var(--app-fg)]">{title}</DialogPrimitive.Title><DialogPrimitive.Close className="absolute right-4 top-4 text-sm text-[var(--app-muted)]">Close</DialogPrimitive.Close><div className="mt-5">{children}</div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}

export default Drawer;
