import type {
	PersonaDetail,
	PersonaListQuery,
	PersonaSummary,
} from "@entities/persona/model/types";
import { personaAdminKeys } from "@features/persona-editor/api/keys";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";

/** 分页读取后台人设档案。 */
export function fetchAdminPersonas(
	query: PersonaListQuery = {},
): Promise<PagedResponse<PersonaSummary>> {
	return apiGetPaged<PersonaSummary>("/admin/personas", { params: query });
}

/** 后台人设档案列表查询。 */
export function useAdminPersonas(query: PersonaListQuery = {}) {
	return useQuery({
		queryKey: personaAdminKeys.list(query),
		queryFn: () => fetchAdminPersonas(query),
	});
}

/** 读取一份后台人设档案。 */
export function fetchAdminPersona(id: string): Promise<PersonaDetail> {
	return apiGet<PersonaDetail>(`/admin/personas/${id}`);
}

/** 后台人设档案详情查询。 */
export function useAdminPersona(id: string) {
	return useQuery({
		queryKey: personaAdminKeys.detail(id),
		queryFn: () => fetchAdminPersona(id),
		enabled: id.length > 0,
	});
}
