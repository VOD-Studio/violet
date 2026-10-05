import type { TweetAffiliation, TweetVerification } from "../data/author.js";
import { safeUrl } from "../data/urls.js";
import { record } from "../fxtwitter/normalize-text.js";

// 与 vercel/react-tweet 的官方 syndication 请求保持一致，不向 FxTwitter 添加无效参数。
const features = [
	"tfw_timeline_list:",
	"tfw_follower_count_sunset:true",
	"tfw_tweet_edit_backend:on",
	"tfw_refsrc_session:on",
	"tfw_fosnr_soft_interventions_enabled:on",
	"tfw_show_birdwatch_pivots_enabled:on",
	"tfw_show_business_verified_badge:on",
	"tfw_duplicate_scribes_to_settings:on",
	"tfw_use_profile_image_shape_enabled:on",
	"tfw_show_blue_verified_badge:on",
	"tfw_legacy_timeline_sunset:true",
	"tfw_show_gov_verified_badge:on",
	"tfw_show_business_affiliate_badge:on",
	"tfw_tweet_edit_frontend:on",
].join(";");

function affiliationFrom(value: unknown): TweetAffiliation | undefined {
	const label = record(value);
	if (label?.user_label_type !== "BusinessLabel" || label.user_label_display_type !== "Badge")
		return;
	const imageUrl = safeUrl(record(label.badge)?.url);
	if (!imageUrl?.startsWith("https://")) return;
	const url = safeUrl(record(label.url)?.url);
	return {
		imageUrl,
		name: typeof label.description === "string" ? label.description : undefined,
		url: url?.startsWith("https://") ? url : undefined,
	};
}

function verificationFrom(user: Record<string, unknown>): TweetVerification | undefined {
	if (user.verified_type === "Business") return "business";
	if (user.verified_type === "Government") return "government";
	if (user.is_blue_verified === true) return "individual";
}

/**
 * 从官方 syndication 补充已公开推文的作者元数据，绝不采用其可能截断的正文。
 *
 * 官方 CORS 仅允许 platform.twitter.com；宿主应通过服务端调用并提供同源 fetcher。
 * 身份不符时不补充数据；明确私密或墓碑状态阻止展示，网络与协议错误按异常传播。
 * @param id - 已校验的推文标识。
 * @param authorId - FxTwitter 返回的作者标识，用于交叉验证身份。
 * @param handle - 已校验的作者账号。
 * @param signal - 调用者的取消信号。
 * @returns 官方元数据或不可用原因；未能交叉验证身份时返回 undefined。
 */
export async function getAuthorMetadata(
	id: string,
	authorId: string,
	handle: string,
	signal?: AbortSignal,
): Promise<
	| {
			verification?: TweetVerification;
			affiliation?: TweetAffiliation;
			unavailable?: "private" | "unavailable";
	  }
	| undefined
> {
	signal?.throwIfAborted();
	if (!/^[1-9]\d{0,19}$/.test(id) || !/^[1-9]\d{0,19}$/.test(authorId)) return;
	const url = new URL("https://cdn.syndication.twimg.com/tweet-result");
	url.search = new URLSearchParams({
		id,
		lang: "en",
		features,
		token: ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, ""),
	}).toString();
	const response = await fetch(url.href, {
		signal,
		credentials: "omit",
		redirect: "error",
		headers: { Accept: "application/json" },
	});
	signal?.throwIfAborted();
	if (response.status === 404 || response.status === 401 || response.status === 403) return;
	if (!response.ok) throw new Error(`X syndication request failed (${response.status})`);
	if (!response.headers.get("content-type")?.toLowerCase().includes("application/json"))
		throw new Error("X syndication returned a non-JSON response");
	const tweet = record(await response.json());
	signal?.throwIfAborted();
	if (!tweet) throw new Error("X syndication returned an invalid response");
	if (tweet.__typename === "TweetTombstone") return { unavailable: "unavailable" };
	const user = record(tweet.user);
	if (
		tweet.__typename !== "Tweet" ||
		tweet.id_str !== id ||
		!user ||
		user.id_str !== authorId ||
		typeof user.screen_name !== "string" ||
		user.screen_name.toLowerCase() !== handle.toLowerCase()
	)
		return;
	if (user.protected === true) return { unavailable: "private" };
	return {
		verification: verificationFrom(user),
		affiliation: affiliationFrom(user.highlighted_label),
	};
}
