import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Button } from "@violet/ui";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOwnAppearance, saveOwnAppearance } from "../../api/appearance";
import { appearanceKeys } from "../../api/appearance-queries";
import { fetchOwnBadges } from "../../api/chat-badges";
import type { ChatAppearanceState } from "../../model/appearance";
import { useChatBackgroundStore } from "../../model/appearance-background";
import { EMPTY_APPEARANCE } from "../../model/appearance-catalog";
import { ChatAppearanceWorkspace } from "./ChatAppearanceWorkspace";
import { useChatBackground } from "./useChatBackground";

vi.mock("../../api/appearance", () => ({
	fetchOwnAppearance: vi.fn(),
	saveOwnAppearance: vi.fn(),
}));
vi.mock("../../api/chat-badges", () => ({ fetchOwnBadges: vi.fn() }));

const user = {
	id: "11111111-1111-4111-8111-111111111111",
	username: "lin",
	display_name: "林间",
	avatar_url: "",
};
const otherID = "22222222-2222-4222-8222-222222222222";
const initial: ChatAppearanceState = { ...EMPTY_APPEARANCE, badge_ids: [], revision: 1 };

function BackgroundSample({ userID }: { userID: string }) {
	return (
		<div data-testid={userID} className={useChatBackground(userID)}>
			会话背景
		</div>
	);
}

function openEditor(saved = initial) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	client.setQueryData(appearanceKeys.own(user.id), saved);
	vi.mocked(fetchOwnAppearance).mockResolvedValue(saved);
	function Harness() {
		const [open, setOpen] = useState(false);
		return (
			<>
				<Button onClick={() => setOpen(true)}>聊天外观设置</Button>
				<input aria-label="消息草稿" defaultValue="还没发送的消息" />
				<BackgroundSample userID={user.id} />
				<BackgroundSample userID={otherID} />
				<ChatAppearanceWorkspace open={open} user={user} onClose={() => setOpen(false)} />
			</>
		);
	}
	render(
		<QueryClientProvider client={client}>
			<Harness />
		</QueryClientProvider>,
	);
	const opener = screen.getByRole("button", { name: "聊天外观设置" });
	opener.focus();
	fireEvent.click(opener);
	return { opener, client };
}

beforeEach(() => {
	vi.resetAllMocks();
	useChatBackgroundStore.setState({ backgrounds: {} });
	localStorage.removeItem("violet:chat-backgrounds");
	vi.mocked(fetchOwnBadges).mockResolvedValue([]);
	vi.mocked(saveOwnAppearance).mockImplementation(async (state) => ({
		...state,
		revision: state.revision + 1,
	}));
});

describe("聊天外观对话框", () => {
	it("展示四种基础款与三种背景,用真实气泡预览并把时间留在气泡外", () => {
		openEditor();
		const dialog = screen.getByRole("dialog", { name: "聊天外观" });
		const bubbles = within(dialog).getByRole("group", { name: "我的气泡" });
		expect(
			within(bubbles)
				.getAllByRole("radio")
				.map((radio) => radio.getAttribute("value")),
		).toEqual(["", "basic-ink", "basic-paper", "basic-washi"]);
		expect(within(dialog).getByRole("radio", { name: "季节", checked: true })).toBeTruthy();
		expect(within(dialog).getByRole("radio", { name: "纸纹", checked: true })).toBeTruthy();
		const preview = screen.getByLabelText("未保存的聊天外观预览");
		expect(preview.querySelectorAll("[data-chat-bubble]")).toHaveLength(2);
		for (const time of preview.querySelectorAll("time")) {
			expect(time.closest("[data-chat-bubble]")).toBeNull();
		}
		expect(within(dialog).getByRole("button", { name: "保存" }).hasAttribute("disabled")).toBe(
			true,
		);
	});

	it("取消丢弃气泡与背景草稿,保留会话输入并归还焦点", async () => {
		const { opener } = openEditor();
		const background = screen.getByTestId(user.id).className;
		fireEvent.click(screen.getByRole("radio", { name: "墨色" }));
		fireEvent.click(screen.getByRole("radio", { name: "纯色" }));
		expect(screen.getByTestId(user.id).className).toBe(background);
		fireEvent.click(screen.getByRole("button", { name: "取消" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(saveOwnAppearance).not.toHaveBeenCalled();
		expect(screen.getByTestId(user.id).className).toBe(background);
		expect((screen.getByRole("textbox", { name: "消息草稿" }) as HTMLInputElement).value).toBe(
			"还没发送的消息",
		);
		await waitFor(() => expect(document.activeElement).toBe(opener));
		fireEvent.click(opener);
		expect(screen.getByRole("radio", { name: "纸纹", checked: true })).toBeTruthy();
		expect(screen.getByRole("radio", { name: "墨色", checked: false })).toBeTruthy();
	});

	it("保存完成才发布气泡和背景,保存中阻止取消与 Escape", async () => {
		const pending = Promise.withResolvers<ChatAppearanceState>();
		vi.mocked(saveOwnAppearance).mockReturnValue(pending.promise);
		const { client } = openEditor();
		const background = screen.getByTestId(user.id).className;
		fireEvent.click(screen.getByRole("radio", { name: "墨色" }));
		fireEvent.click(screen.getByRole("radio", { name: "纯色" }));
		fireEvent.click(screen.getByRole("button", { name: "保存" }));
		await waitFor(() => expect(saveOwnAppearance).toHaveBeenCalledTimes(1));
		expect(client.getQueryData(appearanceKeys.own(user.id))).toEqual(initial);
		expect(screen.getByTestId(user.id).className).toBe(background);
		expect(screen.getByRole("button", { name: "取消" }).hasAttribute("disabled")).toBe(true);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.getByRole("dialog", { name: "聊天外观" })).toBeTruthy();
		const saved = { ...initial, bubble_theme_id: "basic-ink", revision: 2 };
		await act(async () => {
			pending.resolve(saved);
		});
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(client.getQueryData(appearanceKeys.own(user.id))).toEqual(saved);
		expect(screen.getByTestId(user.id).className).not.toBe(background);
		expect(screen.getByTestId(otherID).className).toBe(background);
	});

	it("冲突保留草稿和已应用背景,显式重载后才能替换服务端快照", async () => {
		vi.mocked(saveOwnAppearance).mockRejectedValue({ status: 409 });
		openEditor();
		const background = screen.getByTestId(user.id).className;
		fireEvent.click(screen.getByRole("radio", { name: "和纸" }));
		fireEvent.click(screen.getByRole("radio", { name: "纯色" }));
		fireEvent.click(screen.getByRole("button", { name: "保存" }));
		expect(await screen.findByRole("alert")).toHaveProperty(
			"textContent",
			expect.stringContaining("当前草稿仍保留"),
		);
		expect(screen.getByRole("radio", { name: "和纸", checked: true })).toBeTruthy();
		expect(screen.getByTestId(user.id).className).toBe(background);
		vi.mocked(fetchOwnAppearance).mockResolvedValue({
			...initial,
			bubble_theme_id: "basic-paper",
			revision: 3,
		});
		fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
		await waitFor(() =>
			expect(screen.getByRole("radio", { name: "纸片", checked: true })).toBeTruthy(),
		);
		expect(screen.getByRole("radio", { name: "纯色", checked: true })).toBeTruthy();
	});

	it("仅保存本机背景时保留既有主题和装饰,并按账号持久化", async () => {
		const custom = {
			...initial,
			bubble_theme_id: "moon-letter",
			avatar_frame_id: "moon-cloud",
			avatar_charm_id: "a-crescent",
			badge_ids: ["rua"],
		};
		const { opener, client } = openEditor(custom);
		expect(screen.getByText(/当前使用：/).textContent).toContain("可在更多装饰中更换");
		const initialClass = screen.getByTestId(otherID).className;
		fireEvent.click(screen.getByRole("radio", { name: "纯色" }));
		fireEvent.click(screen.getByRole("button", { name: "保存" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(saveOwnAppearance).not.toHaveBeenCalled();
		expect(client.getQueryData(appearanceKeys.own(user.id))).toEqual(custom);
		expect(screen.getByTestId(user.id).className).not.toBe(initialClass);
		expect(screen.getByTestId(otherID).className).toBe(initialClass);
		const persisted = localStorage.getItem("violet:chat-backgrounds");
		if (persisted === null) {
			throw new Error("保存背景后没有持久化账号偏好");
		}
		await act(async () => {
			useChatBackgroundStore.setState({ backgrounds: {} });
			localStorage.setItem("violet:chat-backgrounds", persisted);
			await useChatBackgroundStore.persist.rehydrate();
		});
		fireEvent.click(opener);
		expect(screen.getByRole("radio", { name: "纯色", checked: true })).toBeTruthy();
		fireEvent.click(screen.getByRole("radio", { name: "纸片" }));
		fireEvent.click(screen.getByRole("button", { name: "保存" }));
		await waitFor(() =>
			expect(saveOwnAppearance).toHaveBeenCalledWith({
				...custom,
				bubble_theme_id: "basic-paper",
			}),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("更多装饰通过可访问折叠按钮展开,收起时保留尚未保存的选项", async () => {
		openEditor();
		const disclosure = screen.getByRole("button", { name: "更多装饰" });
		expect(disclosure.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(disclosure);
		expect(disclosure.getAttribute("aria-expanded")).toBe("true");
		await waitFor(() => expect(fetchOwnBadges).toHaveBeenCalledTimes(1));
		const themes = screen.getByRole("group", { name: "更多气泡主题" });
		const custom = within(themes)
			.getAllByRole("radio")
			.find((radio) => radio.getAttribute("value") === "moon-letter");
		if (!custom) {
			throw new Error("既有气泡主题未显示在更多装饰中");
		}
		fireEvent.click(custom);
		fireEvent.click(disclosure);
		expect(disclosure.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByRole("group", { name: "更多气泡主题" })).toBeNull();
		fireEvent.click(disclosure);
		const reopened = screen.getByRole("group", { name: "更多气泡主题" });
		expect(within(reopened).getByRole("radio", { checked: true }).getAttribute("value")).toBe(
			"moon-letter",
		);
		expect(saveOwnAppearance).not.toHaveBeenCalled();
	});
});
