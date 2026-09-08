import { activePersonaKeys } from "@entities/persona/api/keys";
import type { PersonaDetail } from "@entities/persona/model/types";
import { personaAdminKeys } from "@features/persona-editor/api/keys";
import type { PersonaVersionInput, SavePersonaInput } from "@features/persona-editor/model/types";
import { apiDelete, apiPost, apiPut } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** 创建一份允许内容为空的人设档案。 */
export function useCreatePersona() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => apiPost<PersonaDetail>("/admin/personas"),
		onSuccess: (created) => {
			queryClient.setQueryData(personaAdminKeys.detail(created.id), created);
			queryClient.invalidateQueries({ queryKey: personaAdminKeys.lists() });
		},
	});
}

/** 以完整 document 保存人设档案。 */
export function useSavePersona(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: SavePersonaInput) =>
			apiPut<PersonaDetail>(`/admin/personas/${id}`, input),
		onSuccess: (saved) => {
			queryClient.setQueryData(personaAdminKeys.detail(id), saved);
			queryClient.invalidateQueries({ queryKey: personaAdminKeys.lists() });
			if (saved.is_active) {
				queryClient.invalidateQueries({ queryKey: activePersonaKeys.all });
			}
		},
	});
}

/** 将已保存且完整的档案设为唯一当前人设。 */
export function useActivatePersona(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: PersonaVersionInput) =>
			apiPost<PersonaDetail>(`/admin/personas/${id}/activate`, input),
		onSuccess: (activated) => {
			queryClient.setQueryData(personaAdminKeys.detail(id), activated);
			queryClient.invalidateQueries({ queryKey: personaAdminKeys.lists() });
			queryClient.invalidateQueries({ queryKey: personaAdminKeys.details() });
			queryClient.invalidateQueries({ queryKey: activePersonaKeys.all });
		},
	});
}

/** 删除非当前人设档案。 */
export function useDeletePersona(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: PersonaVersionInput) =>
			apiDelete<null>(`/admin/personas/${id}`, { data: input }),
		onSuccess: () => {
			queryClient.removeQueries({ queryKey: personaAdminKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: personaAdminKeys.lists() });
		},
	});
}
