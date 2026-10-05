import { afterEach, describe, expect, it, vi } from "vitest";

import { getAuthorMetadata } from "./author-metadata.js";

const id = "2027424056291774541";
const authorId = "2721275622";
const handle = "__oQuery";
const imageUrl = "https://pbs.twimg.com/profile_images/2038488993130848256/PyVXwans_bigger.jpg";

/** 组织关联字段取自这条 Innei 推文的真实官方 syndication 响应。 */
function fixture(user: Record<string, unknown> = {}) {
	return {
		__typename: "Tweet",
		id_str: id,
		user: {
			id_str: authorId,
			screen_name: handle,
			verified: false,
			is_blue_verified: true,
			highlighted_label: {
				badge: { url: imageUrl },
				description: "LobeHub",
				url: { url: "https://twitter.com/lobehub", url_type: "DeepLink" },
				user_label_display_type: "Badge",
				user_label_type: "BusinessLabel",
			},
			...user,
		},
	};
}

function respond(data: unknown) {
	const fetcher = vi.fn().mockImplementation(
		async () =>
			new Response(JSON.stringify(data), {
				headers: { "content-type": "application/json" },
			}),
	);
	vi.stubGlobal("fetch", fetcher);
	return fetcher;
}

afterEach(() => vi.unstubAllGlobals());

describe("官方作者认证与组织关联", () => {
	it("按真实字段提取 LobeHub，并固定来源、不带凭证和透传取消", async () => {
		const fetcher = respond(fixture());
		const controller = new AbortController();
		expect(await getAuthorMetadata(id, authorId, handle, controller.signal)).toEqual({
			verification: "individual",
			affiliation: { name: "LobeHub", imageUrl, url: "https://twitter.com/lobehub" },
		});
		const [requestUrl, options] = fetcher.mock.calls[0];
		const url = new URL(requestUrl);
		expect(`${url.origin}${url.pathname}`).toBe(
			"https://cdn.syndication.twimg.com/tweet-result",
		);
		expect(url.searchParams.get("id")).toBe(id);
		expect(url.searchParams.get("token")).toBe(
			((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, ""),
		);
		expect(url.searchParams.get("features")).toContain("tfw_show_business_affiliate_badge:on");
		expect(options).toEqual({
			signal: controller.signal,
			credentials: "omit",
			redirect: "error",
			headers: { Accept: "application/json" },
		});
	});

	it("同样解析 jack 的 Square 关联，不按账号硬编码", async () => {
		const data = fixture({
			id_str: "12",
			screen_name: "jack",
			highlighted_label: {
				badge: {
					url: "https://pbs.twimg.com/profile_images/1285655593592791040/HtwPZgej_bigger.jpg",
				},
				description: "Square",
				url: { url: "https://twitter.com/Square", url_type: "DeepLink" },
				user_label_display_type: "Badge",
				user_label_type: "BusinessLabel",
			},
		});
		data.id_str = "2027129697092731343";
		respond(data);
		expect(await getAuthorMetadata(data.id_str, "12", "jack")).toMatchObject({
			verification: "individual",
			affiliation: { name: "Square", url: "https://twitter.com/Square" },
		});
	});

	it.each([
		[{ verified_type: "Business", is_blue_verified: true }, "business"],
		[{ verified_type: "Government", is_blue_verified: true }, "government"],
		[{ verified: true, is_blue_verified: false }, undefined],
		[{ verified_type: "Unknown", is_blue_verified: false }, undefined],
	] as const)("认证类型按官方字段识别，旧 verified 不冒充蓝标：%j", async (user, expected) => {
		respond(fixture(user));
		expect((await getAuthorMetadata(id, authorId, handle))?.verification).toBe(expected);
	});

	it.each([
		{ user_label_type: "Other", user_label_display_type: "Badge", badge: { url: imageUrl } },
		{
			user_label_type: "BusinessLabel",
			user_label_display_type: "Text",
			badge: { url: imageUrl },
		},
		{
			user_label_type: "BusinessLabel",
			user_label_display_type: "Badge",
			badge: { url: "javascript:alert(1)" },
		},
		{
			user_label_type: "BusinessLabel",
			user_label_display_type: "Badge",
			badge: { url: "/private.png" },
		},
		{ user_label_type: "BusinessLabel", user_label_display_type: "Badge" },
	])("非组织标签或不安全徽标不形成 affiliation：%j", async (label) => {
		respond(fixture({ highlighted_label: label }));
		expect((await getAuthorMetadata(id, authorId, handle))?.affiliation).toBeUndefined();
	});

	it("名称缺失与危险链接不会伪造名称或丢弃合法徽标", async () => {
		respond(
			fixture({
				highlighted_label: {
					user_label_type: "BusinessLabel",
					user_label_display_type: "Badge",
					badge: { url: imageUrl },
					url: { url: "https://user:secret@evil.test" },
				},
			}),
		);
		expect((await getAuthorMetadata(id, authorId, handle))?.affiliation).toEqual({
			imageUrl,
			name: undefined,
			url: undefined,
		});
	});
});

describe("身份、隐私和取消边界", () => {
	it.each([
		{ ...fixture(), id_str: "20" },
		fixture({ id_str: "12" }),
		fixture({ screen_name: "jack" }),
		{},
	])("不将不匹配响应补入快照：%j", async (data) => {
		respond(data);
		expect(await getAuthorMetadata(id, authorId, handle)).toBeUndefined();
	});

	it.each([
		[fixture({ protected: true }), "private"],
		[{ __typename: "TweetTombstone" }, "unavailable"],
	] as const)("官方明确不可用时传递状态而不携带元数据", async (data, reason) => {
		respond(data);
		expect(await getAuthorMetadata(id, authorId, handle)).toEqual({ unavailable: reason });
	});

	it("非法标识和预先取消均不发请求", async () => {
		const fetcher = respond(fixture());
		expect(await getAuthorMetadata("../20", authorId, handle)).toBeUndefined();
		expect(await getAuthorMetadata(id, "invalid", handle)).toBeUndefined();
		const controller = new AbortController();
		controller.abort();
		await expect(
			getAuthorMetadata(id, authorId, handle, controller.signal),
		).rejects.toMatchObject({ name: "AbortError" });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("网络失败与主动取消均向调用者传播", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
		await expect(getAuthorMetadata(id, authorId, handle)).rejects.toThrow("Failed to fetch");
		const controller = new AbortController();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async () => {
				controller.abort();
				throw controller.signal.reason;
			}),
		);
		await expect(
			getAuthorMetadata(id, authorId, handle, controller.signal),
		).rejects.toMatchObject({ name: "AbortError" });
	});

	it.each([
		[429, "application/json", "{}", "429"],
		[200, "text/html", "<html>bad</html>", "non-JSON"],
		[200, "application/json", "null", "invalid response"],
	] as const)("临时 HTTP 与协议错误不伪装成空组织信息", async (status, contentType, body, message) => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(body, {
					status,
					headers: { "content-type": contentType },
				}),
			),
		);
		await expect(getAuthorMetadata(id, authorId, handle)).rejects.toThrow(message);
	});
});
