import type { TweetData, TweetNotice, TweetSnapshot } from "../data/types.js";
import { canonicalUrl, parseTweetId, safeUrl } from "../data/urls.js";
import { normalizeMedia } from "./normalize-media.js";
import { normalizeText, record } from "./normalize-text.js";

/**
 * FxTwitter 推文请求选项。
 *
 * 不允许覆盖请求源或注入认证信息。
 */
export interface GetTweetOptions {
	/**
	 * 可选取消信号，直接传给底层 fetch。
	 *
	 * 取消通过标准 AbortError 拒绝，不改写为内容不可用。
	 */
	signal?: AbortSignal;
}

function normalizeTweet(value: unknown, id: string, depth = 0): TweetData {
	const tweet = record(value);
	if (!tweet || tweet.id !== id) throw new Error("FxTwitter returned an invalid tweet");
	const base = { id, url: canonicalUrl(id) };
	if (tweet.type === "tombstone") {
		return {
			...base,
			availability:
				tweet.reason === "deleted" || tweet.reason === "private"
					? tweet.reason
					: "unavailable",
		};
	}
	const author = record(tweet.author);
	if (author?.protected === true) return { ...base, availability: "private" };
	if (
		!author ||
		typeof author.name !== "string" ||
		typeof author.screen_name !== "string" ||
		!/^[A-Za-z0-9_]{1,15}$/.test(author.screen_name)
	) {
		throw new Error("FxTwitter returned an invalid author");
	}
	const notices: TweetNotice[] = [];
	if (tweet.poll != null) notices.push("poll");
	if (tweet.article != null) notices.push("article");
	if (tweet.truncated === true) notices.push("truncated");
	const verification = record(author.verification);
	const verificationType = verification?.type;
	const snapshot: TweetSnapshot = {
		author: {
			name: author.name,
			handle: author.screen_name,
			url: `https://x.com/${author.screen_name}`,
			avatarUrl: safeUrl(author.avatar_url),
			verification:
				verification?.verified === true &&
				(verificationType === "individual" ||
					verificationType === "business" ||
					verificationType === "government")
					? verificationType
					: undefined,
		},
		...normalizeText(tweet),
		media: normalizeMedia(tweet.media, notices),
		notices,
	};
	const timestamp =
		typeof tweet.created_timestamp === "number"
			? tweet.created_timestamp * 1000
			: typeof tweet.created_at === "string"
				? Date.parse(tweet.created_at)
				: NaN;
	if (Number.isFinite(timestamp) && Math.abs(timestamp) <= 8.64e15)
		snapshot.publishedAt = new Date(timestamp).toISOString();
	const metrics: NonNullable<TweetSnapshot["metrics"]> = {};
	for (const [source, target] of [
		["likes", "likes"],
		["replies", "replies"],
		["retweets", "reposts"],
	] as const) {
		const count = tweet[source];
		if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0)
			metrics[target] = count;
	}
	if (Object.keys(metrics).length) snapshot.metrics = metrics;
	const result: TweetData = {
		...base,
		url: `https://x.com/${author.screen_name}/status/${id}`,
		availability: "available",
		snapshot,
	};
	const quote = record(tweet.quote);
	const quoteId =
		typeof quote?.id === "string" && /^[1-9]\d{0,19}$/.test(quote.id) ? quote.id : null;
	if (quoteId && quoteId !== id) {
		snapshot.quoteUrl = canonicalUrl(quoteId);
		if (depth === 0) {
			try {
				result.quotedTweet = normalizeTweet(quote, quoteId, depth + 1);
			} catch {
				result.quotedTweet = {
					id: quoteId,
					url: snapshot.quoteUrl,
					availability: "unavailable",
				};
			}
		}
	}
	return result;
}

/**
 * 获取并规范化 FxTwitter 完整正文、作者信息与媒体。
 *
 * 不加载脚本、携带凭证或跟随重定向；私密与删除状态不会补回正文。
 * @param id - 十进制推文标识或规范 X/Twitter 原文地址。
 * @param options - 请求取消选项。
 * @returns 可用快照或明确的不可用状态。
 * @throws {TypeError} 推文标识或来源地址不合法。
 * @throws {Error} 网络失败、取消、限流或 JSON 协议校验失败。
 */
export async function getTweet(id: string, options: GetTweetOptions = {}): Promise<TweetData> {
	const parsed = parseTweetId(id);
	if (!parsed) throw new TypeError("Expected a tweet id or an X/Twitter status URL");
	const response = await fetch(`https://api.fxtwitter.com/status/${parsed}`, {
		signal: options.signal,
		credentials: "omit",
		redirect: "error",
		headers: { Accept: "application/json" },
	});
	/** 404 不能证明已删除；私密与删除标记必须来自来源的明确数据。 */
	if (response.status === 404 || response.status === 401 || response.status === 403) {
		return { id: parsed, url: canonicalUrl(parsed), availability: "unavailable" };
	}
	if (!response.ok) throw new Error(`FxTwitter request failed (${response.status})`);
	if (!response.headers.get("content-type")?.toLowerCase().includes("application/json"))
		throw new Error("FxTwitter returned a non-JSON response");
	const envelope = record(await response.json());
	if (!envelope || typeof envelope.code !== "number")
		throw new Error("FxTwitter returned an invalid response");
	if (envelope.code === 404 || envelope.code === 401 || envelope.code === 403) {
		return { id: parsed, url: canonicalUrl(parsed), availability: "unavailable" };
	}
	if (envelope.code !== 200) throw new Error(`FxTwitter request failed (${envelope.code})`);
	const tweet = normalizeTweet(envelope.tweet, parsed);
	options.signal?.throwIfAborted();
	return tweet;
}
