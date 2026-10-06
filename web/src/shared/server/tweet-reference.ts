import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { TweetFetcher } from "@violet/react-tweet";
import { getTweet, parseTweetId } from "@violet/react-tweet/api";

/**
 * 在服务端读取公开推文及作者关联信息。
 *
 * 只接受推文标识或规范 X/Twitter 地址，不开放上游主机或认证参数。
 * @returns 规范化快照或明确的不可用状态。
 */
export const getTweetReference = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const id = typeof value === "string" ? parseTweetId(value) : null;
		if (!id) throw new TypeError("Expected a tweet id or an X/Twitter status URL");
		return id;
	})
	.handler(({ data }) => getTweet(data, { signal: getRequest().signal }));

/**
 * 通过同源 server function 加载推文，避免官方作者接口的浏览器跨域限制。
 * @param id - 推文标识。
 * @param options - 浏览器请求的取消信号。
 * @returns 保留作者关联信息的规范化结果。
 */
export const fetchTweetReference: TweetFetcher = (id, options) =>
	getTweetReference({ data: id, signal: options.signal });
