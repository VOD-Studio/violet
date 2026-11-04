export const windowKeys = {
	all: ["window"] as const,
	state: () => [...windowKeys.all, "state"] as const,
};
