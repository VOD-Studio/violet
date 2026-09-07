import { createFileRoute } from "@tanstack/react-router";
import { fetchPublications, fetchSiteIdentity } from "@widgets/HomeExperience/api/client";
import type { HomePublicationItem, SiteIdentity } from "@widgets/HomeExperience/types";

const RSS_ITEM_LIMIT = 20;

export const Route = createFileRoute("/feed.xml")({
	server: {
		handlers: {
			GET: async () => {
				try {
					const [identity, publications] = await Promise.all([
						fetchSiteIdentity(),
						fetchPublications({ limit: RSS_ITEM_LIMIT }),
					]);
					return new Response(renderRss(identity, publications.data), {
						headers: {
							"Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
							"Content-Type": "application/rss+xml; charset=utf-8",
						},
					});
				} catch {
					return new Response("RSS feed is temporarily unavailable", {
						status: 503,
						headers: { "Content-Type": "text/plain; charset=utf-8" },
					});
				}
			},
		},
	},
});

function renderRss(identity: SiteIdentity, publications: HomePublicationItem[]): string {
	const siteURL = identity.site_url.endsWith("/") ? identity.site_url : `${identity.site_url}/`;
	const selfURL = new URL("feed.xml", siteURL).toString();
	const lastPublishedAt = publications[0]?.published_at;
	const items = publications.map((publication) => renderItem(siteURL, publication)).join("\n");
	const lastBuildDate = lastPublishedAt
		? `\n    <lastBuildDate>${escapeXml(new Date(lastPublishedAt).toUTCString())}</lastBuildDate>`
		: "";

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(identity.site_name)}</title>
    <link>${escapeXml(siteURL)}</link>
    <description>${escapeXml(identity.bio)}</description>
    <language>zh-CN</language>
    <atom:link href="${escapeXml(selfURL)}" rel="self" type="application/rss+xml" />${lastBuildDate}
${items}
  </channel>
</rss>`;
}

function renderItem(siteURL: string, publication: HomePublicationItem): string {
	const href = new URL(publicationPath(publication), siteURL).toString();
	return `    <item>
      <title>${escapeXml(publication.title)}</title>
      <link>${escapeXml(href)}</link>
      <guid isPermaLink="true">${escapeXml(href)}</guid>
      <pubDate>${escapeXml(new Date(publication.published_at).toUTCString())}</pubDate>
    </item>`;
}

function publicationPath(publication: HomePublicationItem): string {
	switch (publication.kind) {
		case "article":
			return `/blog/${encodeURIComponent(publication.route_key)}`;
		case "note":
			return `/notes/${encodeURIComponent(publication.route_key)}`;
		case "gallery":
			return `/galleries/${encodeURIComponent(publication.route_key)}`;
	}
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}
