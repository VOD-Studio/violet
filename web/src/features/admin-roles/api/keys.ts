/**
 * admin-roles Query Keys
 */

export const adminRolesKeys = {
    all: ["admin", "roles"] as const,
    lists: () => [...adminRolesKeys.all, "list"] as const,
    list: () => [...adminRolesKeys.lists()] as const,
};
