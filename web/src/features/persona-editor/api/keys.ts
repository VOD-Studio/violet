import type { PersonaListQuery } from "@entities/persona/model/types";

/** 后台人设档案 query key 工厂。 */
export const personaAdminKeys = {
	all: ["admin-personas"] as const,
	lists: () => [...personaAdminKeys.all, "list"] as const,
	list: (query: PersonaListQuery) => [...personaAdminKeys.lists(), query] as const,
	details: () => [...personaAdminKeys.all, "detail"] as const,
	detail: (id: string) => [...personaAdminKeys.details(), id] as const,
};
