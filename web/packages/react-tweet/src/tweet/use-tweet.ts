"use client";

import { useEffect, useState } from "react";

import type { TweetFetcher } from "../data/fetcher.ts";
import type { TweetData } from "../data/types.ts";

type Result = { status: "loading" } | { status: "error" } | { status: "success"; tweet: TweetData };
interface RequestState {
	id: string;
	fetcher: TweetFetcher;
	attempt: number;
	result: Result;
}

export function useTweet(id: string, fetcher: TweetFetcher): { result: Result; retry: () => void } {
	const [attempt, setAttempt] = useState(0);
	const [state, setState] = useState<RequestState>();
	useEffect(() => {
		const controller = new AbortController();
		let active = true;
		const request = { id, fetcher, attempt };
		setState({ ...request, result: { status: "loading" } });
		/** 自定义加载器同步抛出的异常也进入统一错误状态。 */
		Promise.resolve()
			.then(() => {
				if (!active) return;
				return fetcher(id, { signal: controller.signal });
			})
			.then(
				(tweet) => {
					if (active && tweet)
						setState({ ...request, result: { status: "success", tweet } });
				},
				() => {
					if (active) setState({ ...request, result: { status: "error" } });
				},
			);
		return () => {
			active = false;
			controller.abort();
		};
	}, [id, fetcher, attempt]);
	/** 渲染时比较请求身份，不等待 effect 清理才隐藏旧内容。 */
	const result: Result =
		state?.id === id && state.fetcher === fetcher && state.attempt === attempt
			? state.result
			: { status: "loading" };
	return { result, retry: () => setAttempt((previous) => previous + 1) };
}
