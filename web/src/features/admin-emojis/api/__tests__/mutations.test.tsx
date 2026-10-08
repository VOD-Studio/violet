import type { EmojiGroup } from "@entities/emoji/model/types";
import { adminEmojiKeys } from "@features/admin-emojis/api/keys";
import {
	useBatchUpdateGroupStatus,
	useCreateEmoji,
	useCreateEmojiGroup,
	useDeleteEmoji,
	useDeleteEmojiGroup,
	useUpdateEmoji,
	useUpdateEmojiGroup,
} from "@features/admin-emojis/api/mutations";
import { RefetchBilibiliButton } from "@features/admin-emojis/ui/RefetchBilibiliButton";
import { useAllEmojis, useEmojiGroupByName } from "@features/emojis/api/queries";
import { createQueryClient } from "@shared/api/query-client";
import { apiDelete, apiGet, apiPatch, apiPost } from "@shared/api/request";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const original: EmojiGroup = {
	id: 1,
	name: "默认",
	source: "system",
	sort_order: 0,
	is_enabled: true,
	type: 2,
	emojis: [{ id: 1, name: "旧表情", url: "/old.png", gif_url: "/old.gif" }],
};
const updated: EmojiGroup = {
	...original,
	emojis: [{ id: 1, name: "新表情", url: "/new.png", gif_url: "/new.gif" }],
};
const clients: QueryClient[] = [];

interface MutationCase {
	label: string;
	useMutate: () => () => Promise<unknown>;
}

const mutations: MutationCase[] = [
	{
		label: "创建分组",
		useMutate: function useCreateGroup() {
			const mutation = useCreateEmojiGroup();
			return () => mutation.mutateAsync({ name: "新分组" });
		},
	},
	{
		label: "修改分组",
		useMutate: function useUpdateGroup() {
			const mutation = useUpdateEmojiGroup();
			return () => mutation.mutateAsync({ id: 1, body: { name: "新分组" } });
		},
	},
	{
		label: "批量启用分组",
		useMutate: function useEnableGroup() {
			const mutation = useBatchUpdateGroupStatus();
			return () => mutation.mutateAsync({ ids: [1], is_enabled: true });
		},
	},
	{
		label: "删除分组",
		useMutate: function useDeleteGroup() {
			const mutation = useDeleteEmojiGroup();
			return () => mutation.mutateAsync({ id: 1 });
		},
	},
	{
		label: "创建表情",
		useMutate: function useCreateItem() {
			const mutation = useCreateEmoji();
			return () => mutation.mutateAsync({ groupId: 1, body: { name: "新表情" } });
		},
	},
	{
		label: "修改表情",
		useMutate: function useUpdateItem() {
			const mutation = useUpdateEmoji();
			return () => mutation.mutateAsync({ id: 1, groupId: 1, body: { name: "新表情" } });
		},
	},
	{
		label: "删除表情",
		useMutate: function useDeleteItem() {
			const mutation = useDeleteEmoji();
			return () => mutation.mutateAsync({ id: 1, groupId: 1 });
		},
	},
];

afterEach(() => {
	cleanup();
	for (const client of clients) client.clear();
	clients.length = 0;
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

it.each(mutations)("$label后全量目录与按名查询都读取新动图数据", async ({ useMutate }) => {
	const { wrapper } = setup();
	vi.mocked(apiGet).mockImplementation(async (url) =>
		url === "/emojis" ? [original] : original,
	);
	vi.mocked(apiPost).mockResolvedValue({ id: 2 });
	vi.mocked(apiPatch).mockResolvedValue(null);
	vi.mocked(apiDelete).mockResolvedValue(null);
	const first = renderHook(() => ({ all: useAllEmojis(), named: useEmojiGroupByName("默认") }), {
		wrapper,
	});
	await waitFor(() => {
		expect(first.result.current.all.data).toEqual([original]);
		expect(first.result.current.named.data).toEqual(original);
	});
	first.unmount();

	vi.mocked(apiGet).mockImplementation(async (url) => (url === "/emojis" ? [updated] : updated));
	const mutation = renderHook(useMutate, { wrapper });
	await act(() => mutation.result.current());
	const reopened = renderHook(
		() => ({ all: useAllEmojis(), named: useEmojiGroupByName("默认") }),
		{ wrapper },
	);
	await waitFor(() => {
		expect(reopened.result.current.all.data?.[0]?.emojis[0]?.gif_url).toBe("/new.gif");
		expect(reopened.result.current.named.data?.emojis[0]?.gif_url).toBe("/new.gif");
	});
});

it("B站同步完成时已打开的公开目录立即读到新动图", async () => {
	const { client, wrapper } = setup();
	let catalog = original;
	vi.mocked(apiGet).mockImplementation(async (url) => {
		if (url === "/emojis") return [catalog];
		if (url === "/admin/emojis/bilibili/cookie") return { cookie: "" };
		return { state: "running", groups_done: 0, groups_total: 1 };
	});
	const picker = renderHook(useAllEmojis, { wrapper });
	await waitFor(() => expect(picker.result.current.data).toEqual([original]));
	render(<RefetchBilibiliButton />, { wrapper });
	await waitFor(() =>
		expect(client.getQueryState(adminEmojiKeys.refetchStatus())?.status).toBe("success"),
	);

	catalog = updated;
	act(() => {
		client.setQueryData(adminEmojiKeys.refetchStatus(), {
			state: "done",
			groups_done: 1,
			groups_total: 1,
		});
	});
	await waitFor(() =>
		expect(picker.result.current.data?.[0]?.emojis[0]?.gif_url).toBe("/new.gif"),
	);
});
