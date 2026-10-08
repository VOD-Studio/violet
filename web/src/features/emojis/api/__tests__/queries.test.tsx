import type { EmojiGroup } from "@entities/emoji/model/types";
import { useAllEmojis, useEmojiGroupByName } from "@features/emojis/api/queries";
import { createQueryClient } from "@shared/api/query-client";
import { apiGet } from "@shared/api/request";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({ apiGet: vi.fn() }));

const group: EmojiGroup = {
	id: 1,
	name: "默认",
	source: "system",
	sort_order: 0,
	is_enabled: true,
	type: 2,
	emojis: [{ id: 1, name: "开心", url: "/happy.png", gif_url: "/happy.gif" }],
};

const clients: QueryClient[] = [];

afterEach(() => {
	cleanup();
	for (const client of clients) client.clear();
	clients.length = 0;
	vi.restoreAllMocks();
	vi.resetAllMocks();
});

function setup() {
	const client = createQueryClient();
	clients.push(client);
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return { client, wrapper };
}

it("系统目录卸载两分钟后重新打开复用原有动图数据，不重复请求", async () => {
	const { wrapper } = setup();
	vi.mocked(apiGet).mockResolvedValue([group]);
	const now = Date.now();
	const first = renderHook(useAllEmojis, { wrapper });
	await waitFor(() => expect(first.result.current.data).toEqual([group]));
	first.unmount();

	vi.spyOn(Date, "now").mockReturnValue(now + 2 * 60_000);
	const reopened = renderHook(useAllEmojis, { wrapper });
	await act(async () => {});

	expect(reopened.result.current.data?.[0]?.emojis[0]?.gif_url).toBe("/happy.gif");
	expect(apiGet).toHaveBeenCalledTimes(1);
});

it("按名打开同一分组也复用五分钟内的动图数据", async () => {
	const { wrapper } = setup();
	vi.mocked(apiGet).mockResolvedValue(group);
	const now = Date.now();
	const first = renderHook(() => useEmojiGroupByName("默认"), { wrapper });
	await waitFor(() => expect(first.result.current.data).toEqual(group));
	first.unmount();

	vi.spyOn(Date, "now").mockReturnValue(now + 2 * 60_000);
	const reopened = renderHook(() => useEmojiGroupByName("默认"), { wrapper });
	await act(async () => {});

	expect(reopened.result.current.data?.emojis[0]?.gif_url).toBe("/happy.gif");
	expect(apiGet).toHaveBeenCalledTimes(1);
});
