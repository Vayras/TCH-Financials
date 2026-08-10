import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AppRole = 'super_admin' | 'accounts' | 'tch_member' | 'creator';

export const ROLE_LABELS: Record<AppRole, string> = {
	super_admin: 'Super Admin',
	accounts: 'Accounts',
	tch_member: 'TCH Member',
	creator: 'Creator',
};

export interface Profile {
	id: string;
	email: string;
	role: AppRole;
	status: 'pending' | 'approved' | 'rejected';
	createdAt: string;
	displayName?: string;
	creatorId?: string | null;
}

export interface Invitation {
	id: string;
	email: string;
	role: AppRole;
	createdAt: string;
	acceptedAt: string | null;
}

export interface AdminUsersResponse {
	profiles: Profile[];
	invitations: Invitation[];
}

export const ADMIN_USERS_QUERY_KEY = ['admin-users'];

export function useAdminUsersQuery() {
	return useQuery({
		queryKey: ADMIN_USERS_QUERY_KEY,
		queryFn: () => api.get<AdminUsersResponse>('/admin/users'),
	});
}

export function useApproveUserMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.post(`/admin/users/${id}/approve`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
		},
	});
}

export function useRejectUserMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.post(`/admin/users/${id}/reject`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
		},
	});
}

export function useRevokeAccessMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.post(`/admin/users/${id}/revoke`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
		},
	});
}

export function useDeleteUserMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.del(`/admin/users/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
		},
	});
}

export function useUpdateRoleMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, role, creatorId }: { id: string; role: AppRole; creatorId?: string }) =>
			api.post(`/admin/users/${id}/role`, { role, creatorId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
		},
	});
}

export function useInviteUserMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: { email: string; role: AppRole }) =>
			api.post('/admin/users/invite', payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
		},
	});
}

export function useRemoveInviteMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.del(`/admin/users/invitations/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
		},
	});
}

export function useUpdateProfileMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: { displayName: string; avatarUrl?: string }) =>
			api.patch<{ success: boolean; profile: Profile }>('/auth/profile', body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		},
	});
}
