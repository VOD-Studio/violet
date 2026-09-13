import { authKeys } from "@features/auth/api/keys";
import { httpClient } from "@shared/api/http";
import { useShareTweetStore } from "@shared/api/share-tweet-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chatKeys } from "../../api/keys";
import { ShareTweetDialog } from "../ShareTweetDialog";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

const originalAdapter = httpClient.defaults.adapter;
const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

afterEach(() => {
	cleanup();
	queryClient.clear();
	httpClient.defaults.adapter = originalAdapter;
	useShareTweetStore.setState({ tweet: null, pending: null });
});

describe("ShareTweetDialog 私有查询边界", () => {
	it("关闭时不请求聊天数据，登录后打开才加载，关闭后失效缓存也不重发", async () => {
		const requests: string[] = [];
		httpClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
			requests.push(config.url ?? "");
			return {
				data: { data: [], meta: {} },
				status: 200,
				statusText: "OK",
				headers: {},
				config,
			};
		};
		queryClient.setQueryData(authKeys.me(), null);

		await act(async () => {
			render(
				<QueryClientProvider client={queryClient}>
					<ShareTweetDialog />
				</QueryClientProvider>,
			);
		});
		expect(requests).toEqual([]);

		await act(async () => {
			useShareTweetStore.getState().open({
				id: "tweet-1",
				authorUsername: "author",
				content: "分享内容",
			});
		});
		expect(requests).toEqual([]);

		await act(async () => {
			queryClient.setQueryData(authKeys.me(), { id: "viewer" });
		});
		await waitFor(() => expect(requests).toEqual(["/chat/conversations"]));

		await act(async () => {
			useShareTweetStore.getState().close();
		});
		requests.length = 0;
		await act(async () => {
			await queryClient.invalidateQueries({ queryKey: chatKeys.root });
		});
		expect(requests).toEqual([]);
	});
});
