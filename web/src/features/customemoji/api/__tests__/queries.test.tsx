/// <reference lib="es2024.promise" />
import { useAdminDeleteCustomEmoji } from "@features/admin-customemojis/api/queries";
import { useLogout } from "@features/auth/api/mutations";
import { customEmojiKeys } from "@features/customemoji/api/keys";
import {
	useCreateCustomEmoji,
	useDeleteCustomEmoji,
	useFavoriteCustomEmoji,
	useMyCustomEmojis,
	useUnfavoriteCustomEmoji,
} from "@features/customemoji/api/queries";
import type { MineCustomEmojisRawDTO } from "@features/customemoji/model/types";
import { createQueryClient } from "@shared/api/query-client";
import { apiDelete, apiGet, apiPost } from "@shared/api/request";
import { useSessionStore } from "@shared/api/session";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { GenericAbortSignal } from "axios";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
	apiDelete: vi.fn(),
	apiPatch: vi.fn(),
}));

const alice: MineCustomEmojisRawDTO = {
	owned: [{ id: "alice-emoji", name: "Alice的表情", url: "/alice.gif" }],
	favorited: [],
};
const bob: MineCustomEmojisRawDTO = {
	owned: [{ id: "bob-emoji", name: "Bob的表情", url: "/bob.gif" }],
	favorited: [],
};
const clients: QueryClient[] = [];

beforeEach(() => {
	useSessionStore.setState({ sessionActive: true, sessionVersion: 1 });
});

afterEach(() => {
	cleanup();
	for (const client of clients) client.clear();
	clients.length = 0;
	vi.resetAllMocks();
	useSessionStore.setState({ sessionActive: false, sessionVersion: 0 });
});

function setup() {
	const client = createQueryClient();
	clients.push(client);
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return { client, wrapper };
}

it("关闭后重新打开我的表情复用当前会话数据", async () => {
	const { wrapper } = setup();
	vi.mocked(apiGet).mockResolvedValue(alice);
	const first = renderHook(() => useMyCustomEmojis(true), { wrapper });
	await waitFor(() => expect(first.result.current.data?.owned[0]?.name).toBe("Alice的表情"));
	first.unmount();
	await act(async () => {
		const { promise, resolve } = Promise.withResolvers<void>();
		setTimeout(resolve, 0);
		await promise;
	});

	const reopened = renderHook(() => useMyCustomEmojis(true), { wrapper });
	await act(async () => {});
	expect(reopened.result.current.data?.owned[0]?.name).toBe("Alice的表情");
	expect(apiGet).toHaveBeenCalledTimes(1);
});

it("面板已卸载时登出仍删除私有缓存，下一账号不显示上一账号表情", async () => {
	const { client, wrapper } = setup();
	vi.mocked(apiGet).mockResolvedValueOnce(alice).mockResolvedValue(bob);
	vi.mocked(apiPost).mockResolvedValue({ message: "ok" });
	const first = renderHook(() => useMyCustomEmojis(true), { wrapper });
	await waitFor(() => expect(first.result.current.data?.owned[0]?.name).toBe("Alice的表情"));
	first.unmount();

	const logout = renderHook(useLogout, { wrapper });
	await act(() => logout.result.current.mutateAsync());
	expect(client.getQueryData(customEmojiKeys.mine(1))).toBeUndefined();
	const loggedOut = renderHook(() => useMyCustomEmojis(false), { wrapper });
	expect(loggedOut.result.current.data).toBeUndefined();
	expect(apiGet).toHaveBeenCalledTimes(1);
	loggedOut.unmount();

	act(() => useSessionStore.getState().markSessionActive());
	const next = renderHook(() => useMyCustomEmojis(true), { wrapper });
	expect(next.result.current.data).toBeUndefined();
	await waitFor(() => expect(next.result.current.data?.owned[0]?.name).toBe("Bob的表情"));
	expect(client.getQueryData(customEmojiKeys.mine(1))).toBeUndefined();
});

it("登出取消在途私有请求，迟到响应不能写回旧会话或覆盖新账号", async () => {
	const { client, wrapper } = setup();
	const { promise, resolve: finishOldRequest } = Promise.withResolvers<MineCustomEmojisRawDTO>();
	let oldSignal: GenericAbortSignal | undefined;
	vi.mocked(apiGet).mockImplementationOnce((_url, config) => {
		oldSignal = config?.signal;
		return promise;
	});
	vi.mocked(apiGet).mockResolvedValue(bob);
	vi.mocked(apiPost).mockResolvedValue({ message: "ok" });
	const first = renderHook(
		() => useMyCustomEmojis(useSessionStore((state) => state.sessionActive)),
		{ wrapper },
	);
	await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
	const logout = renderHook(useLogout, { wrapper });
	await act(() => logout.result.current.mutateAsync());
	expect(oldSignal?.aborted).toBe(true);
	expect(client.getQueryData(customEmojiKeys.mine(1))).toBeUndefined();

	act(() => useSessionStore.getState().markSessionActive());
	await waitFor(() => expect(first.result.current.data?.owned[0]?.name).toBe("Bob的表情"));
	await act(async () => finishOldRequest(alice));
	expect(first.result.current.data?.owned[0]?.name).toBe("Bob的表情");
	expect(client.getQueryData(customEmojiKeys.mine(1))).toBeUndefined();
});

it.each([
	[
		"上传",
		function useUpload() {
			const mutation = useCreateCustomEmoji();
			return () => mutation.mutateAsync({ name: "新表情", url: "/new.gif" });
		},
	],
	[
		"删除",
		function useDelete() {
			const mutation = useDeleteCustomEmoji();
			return () => mutation.mutateAsync("alice-emoji");
		},
	],
	[
		"后台下架",
		function useAdminDelete() {
			const mutation = useAdminDeleteCustomEmoji();
			return () => mutation.mutateAsync("alice-emoji");
		},
	],
	[
		"收藏",
		function useFavorite() {
			const mutation = useFavoriteCustomEmoji();
			return () => mutation.mutateAsync("new-emoji");
		},
	],
	[
		"移出收藏",
		function useUnfavorite() {
			const mutation = useUnfavoriteCustomEmoji();
			return () => mutation.mutateAsync("favorite-emoji");
		},
	],
])("%s成功后再次打开读取更新后的我的表情", async (_label, useMutate) => {
	const { wrapper } = setup();
	vi.mocked(apiGet).mockResolvedValueOnce(alice).mockResolvedValue({ owned: [], favorited: [] });
	vi.mocked(apiPost).mockResolvedValue(null);
	vi.mocked(apiDelete).mockResolvedValue(null);
	const first = renderHook(() => useMyCustomEmojis(true), { wrapper });
	await waitFor(() => expect(first.result.current.data?.owned[0]?.name).toBe("Alice的表情"));
	first.unmount();

	const mutation = renderHook<() => Promise<unknown>, void>(useMutate, { wrapper });
	await act(() => mutation.result.current());
	const reopened = renderHook(() => useMyCustomEmojis(true), { wrapper });
	await waitFor(() => expect(reopened.result.current.data?.owned).toEqual([]));
	expect(apiGet).toHaveBeenCalledTimes(2);
});
