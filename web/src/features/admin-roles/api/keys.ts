/**
 * admin-roles Query Keys
 */

export const adminRolesKeys = {
    all: ["admin", "roles"] as const,
    lists: () => [...adminRolesKeys.all, "list"] as const,
    list: () => [...adminRolesKeys.lists()] as const,
    details: () => [...adminRolesKeys.all, "detail"] as const,
    detail: (id: number) => [...adminRolesKeys.details(), id] as const,
};
