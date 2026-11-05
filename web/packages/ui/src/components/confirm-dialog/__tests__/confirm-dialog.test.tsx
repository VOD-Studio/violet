import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../confirm-dialog";

type Props = Partial<ComponentProps<typeof ConfirmDialog>>;

function DeletePost(props: Props) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				永久删除
			</button>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				title="永久删除「独库公路，六天」？"
				description="12 条评论和 3 条批注会一起删除，无法恢复。"
				confirmLabel="永久删除"
				onConfirm={() => {}}
				{...props}
			/>
		</>
	);
}

const open = () => {
	const opener = screen.getByRole("button", { name: "永久删除" });
	opener.focus();
	fireEvent.click(opener);
	return opener;
};
const panel = () => screen.queryByRole("alertdialog");
const inPanel = (name: string) =>
	screen.getAllByRole("button", { name }).find((button) => panel()?.contains(button));
const description = (element: HTMLElement) =>
	document.getElementById(element.getAttribute("aria-describedby") ?? "")?.textContent;

describe("ConfirmDialog", () => {
	it("以标题命名、以说明描述，焦点落到取消", () => {
		render(<DeletePost />);
		open();
		const dialog = screen.getByRole("alertdialog", { name: "永久删除「独库公路，六天」？" });
		expect(description(dialog)).toBe("12 条评论和 3 条批注会一起删除，无法恢复。");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "取消" }));
	});

	it("Esc 与取消等价，关闭后焦点回到打开它的按钮", async () => {
		render(<DeletePost />);
		const opener = open();
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		expect(panel()).toBeNull();
		await waitFor(() => expect(document.activeElement).toBe(opener));
		open();
		fireEvent.click(screen.getByRole("button", { name: "取消" }));
		expect(panel()).toBeNull();
	});

	it("点遮罩不关闭，焦点回到取消并提示一句", async () => {
		render(<DeletePost />);
		open();
		inPanel("永久删除")?.focus();
		// Radix 在宏任务里才登记外部按下监听，点外面推迟到 click 才处理
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
		fireEvent.pointerUp(document.body, { pointerType: "mouse", button: 0 });
		fireEvent.click(document.body);
		expect(panel()).not.toBeNull();
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "取消" }));
		expect(screen.getByText("点遮罩不会关闭，按 Esc 或点「取消」")).toBeTruthy();
	});

	it("执行中动作按钮换成进行时，取消与 Esc 暂不可用", () => {
		const onOpenChange = vi.fn();
		render(
			<ConfirmDialog
				open
				onOpenChange={onOpenChange}
				title="永久删除「独库公路，六天」？"
				confirmLabel="删除"
				loading
				onConfirm={() => {}}
			/>,
		);
		const action = screen.getByRole("button", { name: /正在删除…/ });
		expect(action.getAttribute("aria-busy")).toBe("true");
		expect((screen.getByRole("button", { name: "取消" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
		fireEvent.keyDown(action, { key: "Escape" });
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("打开后才进入执行中时 Esc 同样不可用", () => {
		const onOpenChange = vi.fn();
		const props = {
			open: true,
			onOpenChange,
			title: "永久删除「独库公路，六天」？",
			confirmLabel: "删除",
			onConfirm: () => {},
		};
		const { rerender } = render(<ConfirmDialog {...props} />);
		rerender(<ConfirmDialog {...props} loading />);
		fireEvent.keyDown(screen.getByRole("button", { name: /正在删除…/ }), { key: "Escape" });
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("失败时不关闭，在按钮上方写出原因", () => {
		render(
			<ConfirmDialog
				open
				onOpenChange={() => {}}
				title="永久删除「独库公路，六天」？"
				confirmLabel="永久删除"
				error="没有删除：网络中断，文章还在。可以再试一次。"
				onConfirm={() => {}}
			/>,
		);
		expect(screen.getByRole("alert").textContent).toBe(
			"没有删除：网络中断，文章还在。可以再试一次。",
		);
		expect(panel()).not.toBeNull();
	});

	it("影响很大时输入名称后动作按钮才可用，回车执行", () => {
		const onConfirm = vi.fn();
		render(<DeletePost confirmText="Rust 全栈笔记" onConfirm={onConfirm} />);
		open();
		const field = screen.getByRole("textbox", { name: "输入 Rust 全栈笔记 继续" });
		expect(document.activeElement).toBe(field);
		const action = inPanel("永久删除") as HTMLButtonElement;
		expect(action.disabled).toBe(true);
		fireEvent.keyDown(field, { key: "Enter" });
		expect(onConfirm).not.toHaveBeenCalled();
		fireEvent.change(field, { target: { value: "Rust 全栈笔记" } });
		expect(action.disabled).toBe(false);
		fireEvent.keyDown(field, { key: "Enter" });
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("关闭后重开时清空输入与提示", async () => {
		render(<DeletePost confirmText="Rust 全栈笔记" />);
		open();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "Rust" } });
		fireEvent.click(screen.getByRole("button", { name: "取消" }));
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		open();
		expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
	});
});
