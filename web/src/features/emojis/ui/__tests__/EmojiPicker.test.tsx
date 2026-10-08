import type { EmojiGroup } from "@entities/emoji/model/types";
import type { MineCustomEmojisRawDTO } from "@features/customemoji/model/types";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { httpClient } from "@shared/api/http";
import { useSessionStore } from "@shared/api/session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError } from "axios";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const groups: EmojiGroup[] = [
	{
		id: 1,
		name: "默认",
		source: "system",
		sort_order: 0,
		is_enabled: true,
		type: 2,
		emojis: [{ id: 1, name: "赞", url: "/uploads/emojis/like.png" }],
	},
	{
		id: 2,
		name: "动态",
		source: "system",
		sort_order: 1,
		is_enabled: true,
		type: 2,
		emojis: [
			{
				id: 2,
				name: "开心",
				url: "/uploads/emojis/happy.png",
				gif_url: "/uploads/emojis/happy.gif",
			},
		],
	},
];

const originalAdapter = httpClient.defaults.adapter;
let queryClient: QueryClient;
let mine: MineCustomEmojisRawDTO;
let uploadedNames: string[];
let failEndpoint: string | null;
let failedRequests: string[];

beforeEach(() => {
	mine = { owned: [], favorited: [] };
	uploadedNames = [];
	failEndpoint = null;
	failedRequests = [];
	queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	useSessionStore.setState({ sessionActive: false, sessionVersion: 0 });
	httpClient.defaults.adapter = async (config) => {
		if (config.url === failEndpoint) {
			failedRequests.push(config.url);
			throw new AxiosError("请求失败", "ERR_BAD_RESPONSE", config, undefined, {
				data: { error: "INTERNAL", message: "请求失败" },
				status: 500,
				statusText: "Internal Server Error",
				headers: {},
				config,
			});
		}
		let data: unknown;
		switch (config.url) {
			case "/emojis":
				data = groups;
				break;
			case "/custom-emojis/mine":
				data = mine;
				break;
			case "/uploads/emoji": {
				if (!(config.data instanceof FormData)) throw new Error("Missing upload form");
				const file = config.data.get("file");
				if (!(file instanceof File)) throw new Error("Missing upload file");
				uploadedNames.push(file.name);
				data = {
					url: "/uploads/emojis/created.gif",
					filename: "created.gif",
					size: file.size,
					mime_type: file.type,
				};
				break;
			}
			case "/custom-emojis": {
				const body = JSON.parse(config.data);
				mine = {
					...mine,
					owned: [...mine.owned, { id: "created", name: body.name, url: body.url }],
				};
				data = mine.owned.at(-1);
				break;
			}
			default:
				throw new Error(`Unexpected request: ${config.url}`);
		}
		return { data: { data }, status: 200, statusText: "OK", headers: {}, config };
	};
});

afterEach(() => {
	cleanup();
	queryClient.clear();
	httpClient.defaults.adapter = originalAdapter;
	useSessionStore.setState({ sessionActive: false, sessionVersion: 0 });
	vi.restoreAllMocks();
});

it("左右切组不回绕，选择表情后重开仍保留刚浏览的分组", async () => {
	const onSelect = vi.fn();
	render(
		<QueryClientProvider client={queryClient}>
			<EmojiPicker onSelect={onSelect} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "添加表情" }));
	await screen.findByRole("button", { name: "赞" });

	expect(screen.getByRole("button", { name: "上一组" }).hasAttribute("disabled")).toBe(true);
	fireEvent.click(screen.getByRole("button", { name: "下一组" }));
	const happy = await screen.findByRole("button", { name: "开心" });
	expect(screen.queryByRole("button", { name: "赞" })).toBeNull();
	expect(screen.getByRole("button", { name: "下一组" }).hasAttribute("disabled")).toBe(true);
	fireEvent.click(happy);
	expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
	await waitFor(() => expect(screen.queryByRole("button", { name: "开心" })).toBeNull());

	fireEvent.click(screen.getByRole("button", { name: "添加表情" }));
	await screen.findByRole("button", { name: "开心" });
	fireEvent.click(screen.getByRole("button", { name: "上一组" }));
	await screen.findByRole("button", { name: "赞" });
});

it("有动图时网格和聚焦预览都显示动图，方向键只切换导航中的分组", async () => {
	render(
		<QueryClientProvider client={queryClient}>
			<EmojiPicker onSelect={vi.fn()} closeOnSelect={false} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "添加表情" }));
	const first = await screen.findByRole("tab", { name: "默认" });
	act(() => first.focus());
	fireEvent.keyDown(first, { key: "ArrowRight" });
	const second = screen.getByRole("tab", { name: "动态" });
	expect(document.activeElement).toBe(second);
	const happy = await screen.findByRole("button", { name: "开心" });
	expect(within(happy).getByRole("img").getAttribute("src")).toBe("/uploads/emojis/happy.gif");

	act(() => happy.focus());
	await screen.findByRole("tooltip", { name: "开心预览" });
	expect(screen.getByAltText("开心预览").getAttribute("src")).toBe("/uploads/emojis/happy.gif");
	fireEvent.keyDown(happy, { key: "ArrowLeft" });
	expect(screen.getByRole("tab", { name: "动态" }).getAttribute("aria-selected")).toBe("true");
	fireEvent.keyDown(happy, { key: "Escape" });
	await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
});

it("收藏入口位于首项，自传与收藏合并显示，上传先命名确认再加入网格", async () => {
	useSessionStore.setState({ sessionActive: true, sessionVersion: 1 });
	mine = {
		owned: [{ id: "owned", name: "自传猫", url: "/owned.gif" }],
		favorited: [{ id: "favorite", name: "收藏狗", url: "/favorite.gif" }],
	};
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:emoji-preview");
	const revoke = vi.spyOn(URL, "revokeObjectURL");
	const onSelect = vi.fn();
	render(
		<QueryClientProvider client={queryClient}>
			<EmojiPicker onSelect={onSelect} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "添加表情" }));
	expect(screen.getAllByRole("tab")[0].getAttribute("aria-label")).toBe("收藏表情");
	await screen.findByRole("button", { name: "收藏狗" });
	const panel = screen.getByRole("tabpanel");
	expect(
		within(panel)
			.getAllByRole("button")
			.map((button) => button.getAttribute("aria-label")),
	).toEqual(["上传表情", "自传猫", "收藏狗"]);
	const input = screen.getByLabelText("选择表情图片");
	fireEvent.change(input, {
		target: { files: [new File(["gif"], "my_cat.gif", { type: "image/gif" })] },
	});
	const name = screen.getByRole<HTMLInputElement>("textbox", { name: "表情名称" });
	expect(name.value).toBe("mycat");
	expect(uploadedNames).toEqual([]);

	fireEvent.change(name, { target: { value: "手绘_猫" } });
	fireEvent.click(screen.getByRole("button", { name: "确认添加" }));
	expect(uploadedNames).toEqual([]);
	expect(screen.getByRole("textbox", { name: "表情名称" })).toBe(name);
	fireEvent.change(name, { target: { value: "手绘猫" } });
	fireEvent.click(screen.getByRole("button", { name: "确认添加" }));
	const created = await screen.findByRole("button", { name: "手绘猫" });
	expect(uploadedNames).toEqual(["my_cat.gif"]);
	expect(revoke).toHaveBeenCalledWith("blob:emoji-preview");
	expect(screen.queryByRole("textbox", { name: "表情名称" })).toBeNull();
	fireEvent.click(created);
	expect(onSelect).toHaveBeenCalledWith(
		expect.objectContaining({ name: "手绘猫", custom_emoji_id: "created", relation: "owned" }),
	);
});

it("仅系统表情的回应入口不显示个人分组，已选表情不可再次选择", async () => {
	useSessionStore.setState({ sessionActive: true, sessionVersion: 1 });
	const onSelect = vi.fn();
	render(
		<QueryClientProvider client={queryClient}>
			<EmojiPicker onSelect={onSelect} showMyEmojis={false} selectedIds={new Set([1])} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "添加表情" }));
	const selected = await screen.findByRole("button", { name: "赞（已选择）" });
	expect(screen.queryByRole("tab", { name: "收藏表情" })).toBeNull();
	expect(screen.queryByRole("button", { name: "上传表情" })).toBeNull();
	expect(selected.hasAttribute("disabled")).toBe(true);
	fireEvent.click(selected);
	expect(onSelect).not.toHaveBeenCalled();
});

it.each([
	"/uploads/emoji",
	"/custom-emojis",
])("%s失败后保留命名和文件，用户可重新确认", async (endpoint) => {
	useSessionStore.setState({ sessionActive: true, sessionVersion: 1 });
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:emoji-preview");
	render(
		<QueryClientProvider client={queryClient}>
			<EmojiPicker onSelect={vi.fn()} />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "添加表情" }));
	await screen.findByRole("button", { name: "上传表情" });
	fireEvent.change(screen.getByLabelText("选择表情图片"), {
		target: { files: [new File(["gif"], "保留动图.gif", { type: "image/gif" })] },
	});
	const name = screen.getByRole<HTMLInputElement>("textbox", { name: "表情名称" });
	fireEvent.change(name, { target: { value: "确认后的名字" } });
	failEndpoint = endpoint;
	fireEvent.click(screen.getByRole("button", { name: "确认添加" }));
	await waitFor(() => expect(failedRequests).toEqual([endpoint]));
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "确认添加" }).hasAttribute("disabled")).toBe(
			false,
		),
	);
	expect(name.value).toBe("确认后的名字");
	expect(screen.getByAltText("待上传的表情").getAttribute("src")).toBe("blob:emoji-preview");
	failEndpoint = null;
	fireEvent.click(screen.getByRole("button", { name: "确认添加" }));
	await screen.findByRole("button", { name: "确认后的名字" });
	expect(screen.queryByRole("textbox", { name: "表情名称" })).toBeNull();
});
