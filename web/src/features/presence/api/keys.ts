export const presenceKeys = {
	all: ["presence"] as const,
	current: () => [...presenceKeys.all, "current"] as const,
};
