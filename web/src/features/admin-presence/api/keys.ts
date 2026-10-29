export const adminPresenceKeys = {
	all: ["admin-presence"] as const,
	devices: () => [...adminPresenceKeys.all, "devices"] as const,
	settings: () => [...adminPresenceKeys.all, "settings"] as const,
};
