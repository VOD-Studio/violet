import type { PublicationQuery, PublicationWindow } from "../types";

export const homeResourceKeys = {
	all: ["home-resources"] as const,
	siteIdentity: () => [...homeResourceKeys.all, "site-identity"] as const,
	publications: (query: PublicationQuery) =>
		[...homeResourceKeys.all, "publications", query] as const,
	publicationWindow: (window: PublicationWindow) =>
		[...homeResourceKeys.all, "publication-window", window] as const,
	siteImpression: () => [...homeResourceKeys.all, "site-impression"] as const,
};
