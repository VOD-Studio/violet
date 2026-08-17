/**
 * admin-roles Query Keys
 */

import type { PageQuery } from "@shared/api/types";

export const adminRolesKeys = {
	all: ["admin", "roles"] as const,
	lists: () => [...adminRolesKeys.all, "list"] as const,
	list: (query: PageQuery) => [...adminRolesKeys.lists(), query] as const,
	details: () => [...adminRolesKeys.all, "detail"] as const,
	detail: (id: number) => [...adminRolesKeys.details(), id] as const,
};
