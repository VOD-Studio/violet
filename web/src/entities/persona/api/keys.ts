/** 当前公开人设 query key 工厂。 */
export const activePersonaKeys = {
	all: ["active-persona"] as const,
	current: () => [...activePersonaKeys.all, "current"] as const,
};
