import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageCenter } from "../MessageCenter";
import { MessageToast } from "../MessageToast";

const PANEL = {
	notices: [],
	noticeUnread: 0,
	onSelectNotice: vi.fn(),
	onReadAll: vi.fn(),
};

describe("MessageCenter", () => {
	afterEach(cleanup);

	it("铃铛的名称带上未读总数；全部已读时只有「消息」", () => {
		const { rerender } = render(<MessageCenter unread={5} {...PANEL} />);
		expect(screen.getByRole("button", { name: "消息，5 条未读" })).toBeTruthy();
		rerender(<MessageCenter unread={0} {...PANEL} />);
		expect(screen.getByRole("button", { name: "消息" })).toBeTruthy();
	});

	it("点铃铛展开面板；Esc 归还焦点，重开记住聊天标签", async () => {
		render(
			<MessageCenter
				unread={1}
				{...PANEL}
				chat={{ entries: [], unread: 1, onSelect: vi.fn() }}
			/>,
		);
		expect(screen.queryByRole("dialog", { name: "消息" })).toBeNull();
		const bell = screen.getByRole("button", { name: "消息，1 条未读" });
		fireEvent.click(bell);
		expect(screen.getByRole("dialog", { name: "消息" })).toBeTruthy();
		fireEvent.mouseDown(screen.getByRole("tab", { name: /^聊天/ }));

		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "消息" })).toBeNull());
		expect(document.activeElement).toBe(bell);

		fireEvent.click(bell);
		expect(screen.getByRole("tab", { name: /^聊天/ }).getAttribute("aria-selected")).toBe(
			"true",
		);
	});

	it("受控开合只报告意图，由 open 决定是否展开", async () => {
		const onOpenChange = vi.fn();
		const { rerender } = render(
			<MessageCenter unread={0} open={false} onOpenChange={onOpenChange} {...PANEL} />,
		);
		const bell = screen.getByRole("button", { name: "消息" });
		fireEvent.click(bell);
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
		expect(screen.queryByRole("dialog", { name: "消息" })).toBeNull();
		rerender(<MessageCenter unread={0} open onOpenChange={onOpenChange} {...PANEL} />);
		expect(screen.getByRole("dialog", { name: "消息" })).toBeTruthy();
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		expect(bell.getAttribute("aria-expanded")).toBe("true");
		rerender(<MessageCenter unread={0} open={false} onOpenChange={onOpenChange} {...PANEL} />);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "消息" })).toBeNull());
	});

	it("焦点离开面板时关闭，并保留用户选中的外部焦点", async () => {
		render(
			<>
				<button type="button">别处</button>
				<MessageCenter unread={0} {...PANEL} />
			</>,
		);
		fireEvent.click(screen.getByRole("button", { name: "消息" }));
		expect(screen.getByRole("dialog", { name: "消息" })).toBeTruthy();
		const outside = screen.getByRole("button", { name: "别处" });
		act(() => outside.focus());
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "消息" })).toBeNull());
		expect(document.activeElement).toBe(outside);
	});

	it("点外面收起；点全部已读不收起", async () => {
		const onReadAll = vi.fn();
		render(
			<>
				<p>面板外的正文</p>
				<MessageCenter unread={1} {...PANEL} noticeUnread={1} onReadAll={onReadAll} />
			</>,
		);
		const bell = screen.getByRole("button", { name: "消息，1 条未读" });
		fireEvent.click(bell);
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		fireEvent.click(screen.getByRole("button", { name: "全部标为已读" }));
		expect(onReadAll).toHaveBeenCalledTimes(1);
		expect(bell.getAttribute("aria-expanded")).toBe("true");
		const outside = screen.getByText("面板外的正文");
		fireEvent.pointerDown(outside, { pointerType: "mouse", button: 0 });
		fireEvent.pointerUp(outside, { pointerType: "mouse", button: 0 });
		fireEvent.click(outside);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "消息" })).toBeNull());
	});
});

describe("MessageCenter portal", () => {
	afterEach(cleanup);

	it("弹层挂载到宿主指定容器", () => {
		const portal = document.createElement("div");
		document.body.append(portal);
		try {
			render(<MessageCenter unread={0} container={portal} {...PANEL} />);
			const bell = screen.getByRole("button", { name: "消息" });
			fireEvent.click(bell);
			expect(portal.contains(screen.getByRole("dialog", { name: "消息" }))).toBe(true);
		} finally {
			cleanup();
			portal.remove();
		}
	});
});

describe("MessageToast", () => {
	afterEach(cleanup);

	const alert = {
		conversationId: "c1",
		name: "Claude",
		action: "在聊天室回复了你",
		preview: "摘要已经整理好了",
	};

	it("读出谁、做了什么与预览，点回复交给调用方", () => {
		const onReply = vi.fn();
		const { container } = render(<MessageToast alert={alert} onReply={onReply} />);
		expect(container.textContent).toContain("Claude 在聊天室回复了你");
		expect(container.textContent).toContain("摘要已经整理好了");
		fireEvent.click(screen.getByRole("button", { name: "回复" }));
		expect(onReply).toHaveBeenCalledTimes(1);
	});

	it("指针悬停与键盘聚焦时通知调用方暂停，离开后恢复", () => {
		const onPauseChange = vi.fn();
		const { container } = render(
			<MessageToast alert={alert} onReply={vi.fn()} onPauseChange={onPauseChange} />,
		);
		const toast = container.firstElementChild as HTMLElement;
		fireEvent.pointerEnter(toast);
		fireEvent.pointerLeave(toast);
		fireEvent.focus(screen.getByRole("button", { name: "回复" }));
		fireEvent.blur(screen.getByRole("button", { name: "回复" }));
		expect(onPauseChange.mock.calls.map(([paused]) => paused)).toEqual([
			true,
			false,
			true,
			false,
		]);
	});
});
