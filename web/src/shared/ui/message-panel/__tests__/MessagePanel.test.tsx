import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Heart, MessageCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessagePanel, type MessagePanelProps } from "../MessagePanel";
import type { ChatEntry, NoticeEntry } from "../types";

function PlainLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
	return <a href={href} {...props} />;
}

const NOTICES: NoticeEntry[] = [
	{
		id: "n1",
		icon: MessageCircle,
		actor: { name: "林间" },
		text: "评论了你的文章《拆解 Saber》",
		quote: "好，晚上去翻。",
		time: "58 分钟前",
		unread: true,
		group: "today",
	},
	{
		id: "n2",
		icon: Heart,
		actor: { name: "南山记" },
		text: "赞了你的推文",
		time: "前天",
		unread: false,
		group: "earlier",
	},
	{
		id: "n3",
		icon: MessageCircle,
		text: "新公告：评论编辑器即将支持 Markdown",
		time: "昨天",
		unread: false,
		group: "earlier",
	},
];

const CHATS: ChatEntry[] = [
	{ id: "c1", name: "Claude", preview: "摘要已经整理好了", time: "刚刚", unread: 2 },
	{ id: "c2", name: "Gemini", preview: "好的", time: "昨天", unread: 0 },
];

function chatProps(overrides: Partial<NonNullable<MessagePanelProps["chat"]>> = {}) {
	return { entries: CHATS, unread: 2, onSelect: vi.fn(), LinkComponent: PlainLink, ...overrides };
}

function setup(overrides: Partial<MessagePanelProps> = {}) {
	const props: MessagePanelProps = {
		tab: "notice",
		onTabChange: vi.fn(),
		notices: NOTICES,
		noticeUnread: 1,
		onSelectNotice: vi.fn(),
		onReadAll: vi.fn(),
		chat: chatProps(),
		...overrides,
	};
	render(<MessagePanel {...props} />);
	return props;
}

describe("MessagePanel", () => {
	afterEach(cleanup);

	it("两个标签带各自的未读数；有未读才显示数字", () => {
		setup({ chat: chatProps({ unread: 0 }) });
		expect(screen.getByRole("tab", { name: /^通知\s*1$/ })).toBeTruthy();
		expect(screen.getByRole("tab", { name: "聊天" })).toBeTruthy();
	});

	it("通知一行读完：谁、做了什么、原文、时间与未读", () => {
		setup();
		const rows = screen.getAllByRole("button", { name: /前|昨天/ });
		expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
			"林间 评论了你的文章《拆解 Saber》：好，晚上去翻。58 分钟前，未读",
			"南山记 赞了你的推文。前天",
			"新公告：评论编辑器即将支持 Markdown。昨天",
		]);
	});

	it("按今天与更早分组，点一行带出它的 id", () => {
		const props = setup();
		expect(screen.getByRole("group", { name: "今天" })).toBeTruthy();
		const earlier = screen.getByRole("group", { name: "更早" });
		expect(within(earlier).getAllByRole("button")).toHaveLength(2);
		fireEvent.click(screen.getByRole("button", { name: /^南山记/ }));
		expect(props.onSelectNotice).toHaveBeenCalledWith("n2");
	});

	it("全部标为已读：触发回调并读出结果；没有未读时不可点", () => {
		const props = setup();
		fireEvent.click(screen.getByRole("button", { name: "全部标为已读" }));
		expect(props.onReadAll).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("status").textContent).toBe("已全部标为已读");
		cleanup();
		setup({ noticeUnread: 0 });
		expect(
			(screen.getByRole("button", { name: "全部标为已读" }) as HTMLButtonElement).disabled,
		).toBe(true);
	});

	it("切到聊天：列出会话、最新一条与未读数，底部进入聊天室", () => {
		const onTabChange = vi.fn();
		const chat = chatProps();
		setup({ tab: "chat", onTabChange, chat });
		expect(screen.queryByRole("button", { name: "全部标为已读" })).toBeNull();
		const claude = screen.getByRole("button", { name: /^Claude/ });
		expect(claude.textContent).toContain("摘要已经整理好了");
		expect(claude.getAttribute("aria-label")).toBe("Claude，摘要已经整理好了，刚刚，2 条未读");
		fireEvent.click(claude);
		expect(chat.onSelect).toHaveBeenCalledWith("c1");
		expect(screen.getByRole("link", { name: "进入聊天室" }).getAttribute("href")).toBe("/chat");
		fireEvent.mouseDown(screen.getByRole("tab", { name: /^通知\s*1$/ }));
		expect(onTabChange).toHaveBeenCalledWith("notice");
	});

	it("没有聊天（后台等场景）时只有通知，不出现标签", () => {
		setup({ chat: undefined });
		expect(screen.queryByRole("tab")).toBeNull();
		expect(screen.getByRole("heading", { name: "通知" })).toBeTruthy();
	});

	it("浏览器推送开关留在通知标签底部，点一下回调", () => {
		const onChange = vi.fn();
		setup({ push: { checked: false, busy: false, onChange } });
		const toggle = screen.getByRole("switch", { name: "浏览器通知" });
		expect(toggle.getAttribute("aria-checked")).toBe("false");
		fireEvent.click(toggle);
		expect(onChange).toHaveBeenCalledWith(true);
	});

	it("悬停到通知行或会话行上，滑动底色跟过去", () => {
		setup();
		const highlight = () => document.querySelector("[data-list-highlight]");
		expect(highlight()?.getAttribute("data-list-highlight-visible")).not.toBe("true");
		fireEvent.pointerOver(screen.getByRole("button", { name: /^林间/ }));
		expect(highlight()?.getAttribute("data-list-highlight-visible")).toBe("true");
		cleanup();
		setup({ tab: "chat" });
		fireEvent.pointerOver(screen.getByRole("button", { name: /^Gemini/ }));
		expect(highlight()?.getAttribute("data-list-highlight-visible")).toBe("true");
	});

	it("空与加载：通知为空显示空状态，加载中不显示空状态", () => {
		setup({ notices: [], noticeUnread: 0 });
		expect(screen.getByText("暂无通知")).toBeTruthy();
		cleanup();
		setup({ notices: [], noticeUnread: 0, status: "loading" });
		expect(screen.queryByText("暂无通知")).toBeNull();
	});
});
