/**
 * admin-permissions Query Keys
 */

export const adminPermissionsKeys = {
	all: ["admin", "permissions"] as const,
	lists: () => [...adminPermissionsKeys.all, "list"] as const,
	list: () => [...adminPermissionsKeys.lists()] as const,
	details: () => [...adminPermissionsKeys.all, "detail"] as const,
	detail: (id: number) => [...adminPermissionsKeys.details(), id] as const,
};
