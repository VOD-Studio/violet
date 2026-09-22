import type { PageQuery } from "@shared/api/types";

export const botKeys = {
	all: ["chat-bots"] as const,
	list: (query: PageQuery) => [...botKeys.all, "list", query] as const,
};
