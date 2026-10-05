import type { TweetMedia } from "../data/media.js";
import type { TweetNotice } from "../data/types.js";
import { safeUrl } from "../data/urls.js";
import { record } from "./normalize-text.js";

export function normalizeMedia(value: unknown, notices: TweetNotice[]): TweetMedia[] {
	const media = record(value);
	if (!media) return [];
	const all =
		Array.isArray(media.all) && media.all.length
			? media.all
			: [
					...(Array.isArray(media.photos) ? media.photos : []),
					...(Array.isArray(media.videos) ? media.videos : []),
				];
	const result: TweetMedia[] = [];
	for (const item of all) {
		const raw = record(item);
		if (!raw) continue;
		const kind = raw.type === "gif" ? "animated_gif" : raw.type;
		if (kind !== "photo" && kind !== "video" && kind !== "animated_gif") {
			notices.push("unsupported-media");
			continue;
		}
		let url = safeUrl(raw.url);
		if (kind === "photo" && url && !url.startsWith("/")) {
			const original = new URL(url);
			if (original.hostname === "pbs.twimg.com" && original.pathname.startsWith("/media/")) {
				original.searchParams.set("name", "orig");
				url = original.href;
			}
		}
		const thumbnailUrl = safeUrl(raw.thumbnail_url);
		/** 视频源与封面分别处理，绝不将 thumbnail_url 提升为视频源。 */
		if (
			kind !== "photo" &&
			url &&
			(url === thumbnailUrl || /\.(?:jpe?g|png|webp|avif)(?:$|[?#])/i.test(url))
		)
			url = undefined;
		const metadata = {
			width:
				typeof raw.width === "number" && raw.width > 0 && Number.isFinite(raw.width)
					? raw.width
					: undefined,
			height:
				typeof raw.height === "number" && raw.height > 0 && Number.isFinite(raw.height)
					? raw.height
					: undefined,
			alt: typeof raw.altText === "string" ? raw.altText : undefined,
		};
		if (kind === "photo" && url) result.push({ ...metadata, kind, url, thumbnailUrl });
		else if (kind !== "photo" && url) result.push({ ...metadata, kind, url, thumbnailUrl });
		else if (kind !== "photo" && thumbnailUrl) result.push({ ...metadata, kind, thumbnailUrl });
		else notices.push("media-unavailable");
	}
	return result;
}
