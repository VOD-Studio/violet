import { tweetKeys } from "@entities/tweet/api/keys";
import { useShareTweetStore } from "@entities/tweet/model/share-dialog-store";
import { authKeys } from "@features/auth/api/keys";
import { httpClient } from "@shared/api/http";
import { SITE_URL } from "@shared/config/env";
import { copyText } from "@shared/lib/clipboard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chatKeys } from "../../api/keys";
import { ShareTweetDialog } from "../ShareTweetDialog";

vi.mock("@tanstack/react-router", () => ({
	useLocation: () => "/tweets?sort=hot#timeline",
	Link: ({
		to,
		search,
		...props
	}: ComponentProps<"a"> & { to: string; search: { redirect: string } }) => (
		<a {...props} href={`${to}?${new URLSearchParams(search)}`} />
	),
}));
vi.mock("@shared/lib/clipboard", () => ({ copyText: vi.fn(async () => true) }));

const originalAdapter = httpClient.defaults.adapter;
const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const tweet = {
	id: "tweet-1",
	author: { id: "author", username: "author", avatar_url: "" },
	content: "分享内容",
	images: [],
	created_at: "2026-01-01T00:00:00Z",
};
const user = (id: string, label: string) => ({
	id,
	username: id,
	display_name: label,
	avatar_url: "",
});
const room = (id: string, title: string) => ({
	id,
	kind: "room",
	title,
	owner: user("viewer", "站长"),
});

function response(config: InternalAxiosRequestConfig, data: unknown, cursor?: string) {
	return {
		data: { data, meta: { pagination: { next_cursor: cursor ?? null } } },
		status: 200,
		statusText: "OK",
		headers: {},
		config,
	};
}

function failure(config: InternalAxiosRequestConfig, status: number) {
	return new AxiosError("请求失败", undefined, config, undefined, {
		...response(config, null),
		status,
		data: { error: "FAILED", message: "请求失败" },
	});
}

function renderShare(viewer = false) {
	queryClient.setQueryData(authKeys.me(), viewer ? { id: "viewer" } : null);
	render(
		<QueryClientProvider client={queryClient}>
			<ShareTweetDialog />
		</QueryClientProvider>,
	);
}

function openShare() {
	act(() => useShareTweetStore.getState().open("tweet-1"));
}

afterEach(() => {
	cleanup();
	queryClient.clear();
	httpClient.defaults.adapter = originalAdapter;
	useShareTweetStore.getState().close();
	vi.clearAllMocks();
});

describe("分享推文", () => {
	it("匿名可分享公开推文，沿登录链接离开时关闭分享弹窗并保留返回地址", async () => {
		const requests: (string | undefined)[] = [];
		httpClient.defaults.adapter = async (config) => {
			requests.push(config.url);
			return response(config, tweet);
		};
		renderShare();
		expect(requests).toEqual([]);
		openShare();
		await screen.findByText("分享内容");
		const login = screen.getByRole("link", { name: "登录后发到聊天" });
		expect(login.getAttribute("href")).toBe(
			"/login?redirect=%2Ftweets%3Fsort%3Dhot%23timeline",
		);
		fireEvent.click(screen.getByRole("button", { name: "复制链接" }));
		await waitFor(() =>
			expect(copyText).toHaveBeenCalledWith(`${SITE_URL.replace(/\/+$/, "")}/tweets/tweet-1`),
		);
		expect(screen.getByRole("button", { name: "存为图片" })).toBeTruthy();
		expect(screen.queryByRole("searchbox")).toBeNull();
		expect(screen.queryByRole("link", { name: "在 X 打开" })).toBeNull();
		expect(requests).toEqual(["/tweets/tweet-1"]);
		login.addEventListener("click", (event) => event.preventDefault(), { once: true });
		fireEvent.click(login);
		expect(screen.queryByRole("dialog", { name: /^分享$/ })).toBeNull();
	});

	it("登录后搜索后续页，保留已选项；部分失败后只用原幂等键重试失败会话", async () => {
		const sends: { destination: string; key: unknown; input: unknown }[] = [];
		const cursors: (string | undefined)[] = [];
		httpClient.defaults.adapter = async (config) => {
			if (config.url === "/tweets/tweet-1") return response(config, tweet);
			if (config.url === "/chat/conversations") {
				const cursor = config.params.cursor;
				cursors.push(cursor);
				return cursor
					? response(config, [room("b", "远方房间")])
					: response(config, [room("a", "大厅")], "next");
			}
			if (config.url === "/chat/contacts") return response(config, []);
			if (config.url?.endsWith("/messages")) {
				sends.push({
					destination: config.url,
					key: config.headers.get("Idempotency-Key"),
					input: JSON.parse(config.data),
				});
				if (
					config.url.includes("/b/") &&
					sends.filter(({ destination }) => destination.includes("/b/")).length === 1
				) {
					throw failure(config, 403);
				}
				return response(config, {});
			}
			throw new Error(`Unexpected request: ${config.url}`);
		};
		renderShare(true);
		openShare();
		fireEvent.click(await screen.findByRole("button", { name: "大厅" }));
		fireEvent.change(screen.getByRole("searchbox"), { target: { value: "远方" } });
		fireEvent.click(await screen.findByRole("button", { name: "远方房间" }));
		expect(screen.getByRole("button", { name: "大厅" }).getAttribute("aria-pressed")).toBe(
			"true",
		);
		expect(cursors).toEqual([undefined, "next"]);
		fireEvent.change(screen.getByRole("textbox", { name: "附一句话（选填）" }), {
			target: { value: "看看这条" },
		});
		fireEvent.click(screen.getByRole("button", { name: "发送给 2 个会话" }));
		const retry = await screen.findByRole("button", { name: "重试 1 个会话" });
		expect(screen.queryByRole("button", { name: "大厅" })).toBeNull();
		expect(screen.getByRole("button", { name: "远方房间" }).getAttribute("aria-pressed")).toBe(
			"true",
		);
		expect(
			screen.getByRole<HTMLInputElement>("textbox", { name: "附一句话（选填）" }).value,
		).toBe("看看这条");
		fireEvent.click(retry);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		const body = { type: "tweet_share", content: "看看这条", shared_tweet_id: "tweet-1" };
		expect(sends).toEqual([
			{ destination: "/chat/conversations/a/messages", key: expect.any(String), input: body },
			{ destination: "/chat/conversations/b/messages", key: expect.any(String), input: body },
			{ destination: "/chat/conversations/b/messages", key: sends[1].key, input: body },
		]);
		expect(sends[0].key).not.toBe(sends[1].key);
		cursors.length = 0;
		await act(async () => {
			await queryClient.invalidateQueries({ queryKey: chatKeys.root });
		});
		expect(cursors).toEqual([]);
	});

	it("选中联系人不创建会话；发送后重用已建立的会话和幂等键", async () => {
		const creations: unknown[] = [];
		const messageKeys: unknown[] = [];
		httpClient.defaults.adapter = async (config) => {
			if (config.url === "/tweets/tweet-1") return response(config, tweet);
			if (config.url === "/chat/contacts") return response(config, [user("new", "新朋友")]);
			if (config.url === "/chat/conversations") {
				if (config.method === "post") {
					creations.push(JSON.parse(config.data));
					return response(config, { id: "direct-new" });
				}
				return response(config, []);
			}
			if (config.url === "/chat/conversations/direct-new/messages") {
				messageKeys.push(config.headers.get("Idempotency-Key"));
				if (messageKeys.length === 1) throw failure(config, 403);
				return response(config, {});
			}
			throw new Error(`Unexpected request: ${config.url}`);
		};
		renderShare(true);
		openShare();
		fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "新朋友" } });
		fireEvent.click(await screen.findByRole("button", { name: "新朋友" }));
		expect(creations).toEqual([]);
		fireEvent.click(screen.getByRole("button", { name: "发送给 1 个会话" }));
		fireEvent.click(await screen.findByRole("button", { name: "重试 1 个会话" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(creations).toEqual([{ kind: "direct", participant_ids: ["new"] }]);
		expect(messageKeys).toEqual([expect.any(String), messageKeys[0]]);
	});

	it("有真实的 X 原文时，游客可以直接打开它", async () => {
		httpClient.defaults.adapter = async (config) =>
			response(config, {
				...tweet,
				external_tweet: {
					canonical_url: "https://x.com/i/status/123",
					availability: "available",
					snapshot: { text: "X 原文", media: [] },
				},
			});
		renderShare();
		openShare();
		const original = await screen.findByRole("link", { name: "在 X 打开" });
		expect(original.getAttribute("href")).toBe("https://x.com/i/status/123");
	});

	it.each([
		"unavailable",
		"deleted",
		"private",
		"available",
	])("没有快照且 X 原文状态为 %s 时不显示出口", async (availability) => {
		httpClient.defaults.adapter = async (config) =>
			response(config, {
				...tweet,
				external_tweet: { canonical_url: "https://x.com/i/status/123", availability },
			});
		renderShare();
		openShare();
		await screen.findByText("分享内容");
		expect(screen.queryByRole("link", { name: "在 X 打开" })).toBeNull();
	});

	it("推文已删除时，即使已登录也不查会话或展示分享出口", async () => {
		const requests: (string | undefined)[] = [];
		httpClient.defaults.adapter = async (config) => {
			requests.push(config.url);
			throw failure(config, 404);
		};
		queryClient.setQueryData(tweetKeys.detail("tweet-1"), tweet);
		renderShare(true);
		openShare();
		await waitFor(() =>
			expect(document.querySelector('[data-state="deleted"]')).not.toBeNull(),
		);
		expect(screen.queryByRole("button", { name: "复制链接" })).toBeNull();
		expect(screen.queryByRole("button", { name: "存为图片" })).toBeNull();
		expect(requests).toEqual(["/tweets/tweet-1"]);
	});
});
