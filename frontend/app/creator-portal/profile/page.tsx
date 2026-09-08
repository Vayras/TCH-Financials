'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthGuard';
import { useUpdateProfileMutation } from '@/app/users/queries';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Icon from '@/components/ui/Icon';
import { CreatorPageHeader, FieldLabel, PortalCard } from '../components';
import { useCreatorWorkspace } from '../workspace';

export default function CreatorProfilePage() {
	const { email, displayName } = useAuth();
	const { workspace, updateWorkspace, ready } = useCreatorWorkspace();
	const updateProfile = useUpdateProfileMutation();
	const [name, setName] = React.useState(displayName || '');
	const [draft, setDraft] = React.useState(workspace.profile);

	React.useEffect(() => { if (ready) setDraft(workspace.profile); }, [ready, workspace.profile]);
	React.useEffect(() => setName(displayName || ''), [displayName]);

	async function save(event: React.FormEvent) {
		event.preventDefault();
		if (!name.trim()) return;
		try {
			if (name.trim() !== displayName) await updateProfile.mutateAsync({ displayName: name.trim() });
			updateWorkspace((current) => ({ ...current, profile: draft }));
			toast.success('Profile saved', { description: 'Your media-kit preview has been updated.' });
		} catch (error) {
			toast.error('Could not update profile', { description: error instanceof Error ? error.message : undefined });
		}
	}

	return (
		<form onSubmit={save} className="space-y-6">
			<CreatorPageHeader title="My Profile" description="Information used across your creator portal and public media kit." actions={<Button type="submit" variant="primary" disabled={updateProfile.isPending}><Icon name="check" size={13} />{updateProfile.isPending ? 'Saving…' : 'Save changes'}</Button>} />
			<PortalCard className="overflow-hidden">
				<div className="h-28 bg-gradient-to-r from-[#441151] via-[#6f3a79] to-[#b494ba]" />
				<div className="flex flex-wrap items-end gap-4 px-5 pb-5">
					<div className="-mt-8 grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-[var(--n-accent-soft)] text-[16px] font-semibold text-[var(--n-accent)]">{(name || 'C').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
					<div className="min-w-0 flex-1 pt-3"><p className="text-[12px] font-semibold">Profile visuals</p><p className="mt-0.5 text-[10px] text-[var(--n-fg-subtle)]">Image uploads will connect to managed storage in the backend phase.</p></div>
					<div className="flex gap-2 pt-3"><Button variant="outline" disabled><Icon name="upload" size={13} />Profile image</Button><Button variant="outline" disabled><Icon name="images" size={13} />Cover image</Button></div>
				</div>
			</PortalCard>
			<PortalCard className="p-5">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label><FieldLabel>Display name</FieldLabel><Input value={name} onChange={(event) => setName(event.target.value)} required /></label>
					<label><FieldLabel>Email address</FieldLabel><Input value={email} disabled className="opacity-60" /></label>
					<label className="sm:col-span-2"><FieldLabel>Creator headline</FieldLabel><Input value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} placeholder="A short, memorable introduction" /></label>
					<label className="sm:col-span-2"><FieldLabel>Biography</FieldLabel><Textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} className="min-h-[110px]" placeholder="Tell brands who you are, what you create and the audience you serve." maxLength={600} /><span className="mt-1 block text-right text-[9px] text-[var(--n-fg-subtle)]">{draft.bio.length}/600</span></label>
					<label><FieldLabel>Category and niches</FieldLabel><Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Lifestyle, fashion, technology" /></label>
					<label><FieldLabel>Location</FieldLabel><Input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Mumbai, India" /></label>
					<label className="sm:col-span-2"><FieldLabel>Languages</FieldLabel><Input value={draft.languages} onChange={(event) => setDraft({ ...draft, languages: event.target.value })} placeholder="English, Hindi" /></label>
				</div>
			</PortalCard>
		</form>
	);
}
