/** 系统面板 query key 工厂。 */
export const systemKeys = {
	all: ["admin-system"] as const,
	snapshot: () => [...systemKeys.all, "snapshot"] as const,
	history: () => [...systemKeys.all, "history"] as const,
	database: () => [...systemKeys.all, "database"] as const,
	schema: () => [...systemKeys.all, "schema"] as const,
	backups: () => [...systemKeys.all, "backups"] as const,
	task: (id: string) => [...systemKeys.all, "task", id] as const,
};
