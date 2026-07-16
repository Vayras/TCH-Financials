import { useQuery } from '@tanstack/react-query';
import { api, type EntitySummary } from '@/lib/api';

export const ENTITY_SUMMARY_KEY = (
	fy: number | null,
	entity: string,
	period: string
) => ['entity-summary', { fy, entity, period }] as const;

export function useEntitySummaryQuery(
	fy: number | null,
	entityFilter: string,
	period: string
) {
	return useQuery<EntitySummary>({
		queryKey: ENTITY_SUMMARY_KEY(fy, entityFilter, period),
		enabled: fy !== null,
		queryFn: () => {
			const params = new URLSearchParams({ fy: String(fy!) });
			if (entityFilter) params.set('entity', entityFilter);
			if (period.startsWith('Q')) params.set('quarter', period);
			else if (period !== 'FY') params.set('month', period);
			return api.get<EntitySummary>(`/entity-summary/?${params}`);
		}
	});
}
