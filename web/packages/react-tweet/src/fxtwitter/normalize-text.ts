import type { TweetSegment } from "../data/types.js";
import { safeUrl } from "../data/urls.js";

export function record(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function decodeText(text: string): string {
	const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
	return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
		if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? match;
		const point =
			entity[1].toLowerCase() === "x"
				? Number.parseInt(entity.slice(2), 16)
				: Number(entity.slice(1));
		return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
			? String.fromCodePoint(point)
			: match;
	});
}

function utf16Offset(text: string, scalarOffset: unknown): number {
	if (typeof scalarOffset !== "number" || !Number.isInteger(scalarOffset) || scalarOffset < 0) {
		return NaN;
	}
	let index = 0;
	let remaining = scalarOffset;
	for (const character of text) {
		if (remaining === 0) return index;
		index += character.length;
		remaining--;
	}
	return remaining === 0 ? index : NaN;
}

/** 将 FxTwitter 的显示范围和实体片段统一为可直接切片的 UTF-16 偏移。 */
export function normalizeText(tweet: Record<string, unknown>): {
	text: string;
	segments?: TweetSegment[];
} {
	const raw = record(tweet.raw_text);
	if (!raw) {
		if (typeof tweet.text !== "string" || tweet.text.length > 100_000)
			throw new Error("FxTwitter returned invalid text");
		return { text: decodeText(tweet.text) };
	}
	if (typeof raw.text !== "string" || raw.text.length > 100_000)
		throw new Error("FxTwitter returned invalid text");
	const text = raw.text;
	const boundary = (value: unknown): value is number => {
		if (
			typeof value !== "number" ||
			!Number.isInteger(value) ||
			value < 0 ||
			value > text.length
		)
			return false;
		const unit = text.charCodeAt(value);
		return !(unit >= 0xdc00 && unit <= 0xdfff);
	};
	const noteTweet = tweet.is_note_tweet === true;
	const range = raw.display_text_range ?? [0, text.length];
	if (!Array.isArray(range) || range.length !== 2) {
		throw new Error("FxTwitter returned an invalid text range");
	}
	// 普通推文的显示范围为码点，长推文为 UTF-16；实体片段的两种口径恰好相反。
	const scalarRange = raw.display_text_range != null && !noteTweet;
	const start = scalarRange ? utf16Offset(text, range[0]) : range[0];
	const end = scalarRange ? utf16Offset(text, range[1]) : range[1];
	if (!boundary(start) || !boundary(end) || start > end) {
		throw new Error("FxTwitter returned an invalid text range");
	}
	if (raw.facets != null && !Array.isArray(raw.facets))
		throw new Error("FxTwitter returned invalid facets");
	const facets: { type: string; start: number; end: number; value: Record<string, unknown> }[] =
		[];
	for (const item of (raw.facets ?? []) as unknown[]) {
		const facet = record(item);
		if (
			!facet ||
			typeof facet.type !== "string" ||
			!["url", "mention", "hashtag", "media"].includes(facet.type)
		)
			continue;
		const indices = facet.indices;
		if (!Array.isArray(indices) || indices.length !== 2) {
			throw new Error("FxTwitter returned an invalid facet");
		}
		const facetStart = noteTweet ? utf16Offset(text, indices[0]) : indices[0];
		const facetEnd = noteTweet ? utf16Offset(text, indices[1]) : indices[1];
		if (!boundary(facetStart) || !boundary(facetEnd) || facetStart >= facetEnd) {
			throw new Error("FxTwitter returned an invalid facet");
		}
		if (facetEnd <= start || facetStart >= end) continue;
		if (facetStart < start || facetEnd > end) {
			throw new Error("FxTwitter facet crosses text range");
		}
		facets.push({ type: facet.type, start: facetStart, end: facetEnd, value: facet });
	}
	facets.sort(
		(a, b) => a.start - b.start || Number(b.type === "media") - Number(a.type === "media"),
	);
	const segments: TweetSegment[] = [];
	let position = start;
	for (const facet of facets) {
		if (facet.start < position) continue;
		if (facet.start > position)
			segments.push({ kind: "text", text: decodeText(text.slice(position, facet.start)) });
		position = facet.end;
		if (facet.type === "media") continue;
		let label = decodeText(text.slice(facet.start, facet.end));
		let url: string | undefined;
		let kind: TweetSegment["kind"] = "text";
		if (facet.type === "url") {
			url = safeUrl(facet.value.replacement) ?? safeUrl(facet.value.original);
			if (url && typeof facet.value.display === "string" && facet.value.display)
				label = decodeText(facet.value.display);
			kind = "link";
		} else if (facet.type === "mention" && /^@[A-Za-z0-9_]{1,15}$/.test(label)) {
			url = `https://x.com/${label.slice(1)}`;
			kind = "mention";
		} else if (facet.type === "hashtag") {
			url = `https://x.com/hashtag/${encodeURIComponent(label.replace(/^#/, ""))}`;
			kind = "hashtag";
		}
		segments.push(
			url && kind !== "text" ? { kind, text: label, url } : { kind: "text", text: label },
		);
	}
	if (position < end)
		segments.push({ kind: "text", text: decodeText(text.slice(position, end)) });
	if (segments.length) {
		segments[0].text = segments[0].text.trimStart();
		segments[segments.length - 1].text = segments[segments.length - 1].text.trimEnd();
	}
	return { text: segments.map((segment) => segment.text).join(""), segments };
}
