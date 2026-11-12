import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PromptDialog } from "../prompt-dialog";

type Props = Partial<ComponentProps<typeof PromptDialog>>;

function RenameSeries(props: Props) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				重命名系列
			</button>
			<PromptDialog
				open={open}
				onOpenChange={setOpen}
				title="重命名系列"
				defaultValue="Rust 全栈笔记"
				maxLength={24}
				onConfirm={() => {}}
				{...props}
			/>
		</>
	);
}

const open = () => {
	const opener = screen.getByRole("button", { name: "重命名系列" });
	opener.focus();
	fireEvent.click(opener);
	return opener;
};
const dialog = () => screen.queryByRole("dialog");
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe("PromptDialog", () => {
	it("是普通对话框，输入框以标题命名，打开时预填值全选", () => {
		render(<RenameSeries />);
		open();
		expect(screen.getByRole("dialog", { name: "重命名系列" })).toBeTruthy();
		const field = screen.getByRole("textbox", { name: "重命名系列" }) as HTMLInputElement;
		expect(document.activeElement).toBe(field);
		expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
	});

	it("回车提交当前值并关闭，焦点回到打开它的按钮", async () => {
		const onConfirm = vi.fn();
		render(<RenameSeries onConfirm={onConfirm} />);
		const opener = open();
		const field = screen.getByRole("textbox");
		fireEvent.change(field, { target: { value: "Rust 全栈" } });
		fireEvent.keyDown(field, { key: "Enter" });
		expect(onConfirm).toHaveBeenCalledWith("Rust 全栈");
		expect(dialog()).toBeNull();
		await waitFor(() => expect(document.activeElement).toBe(opener));
	});

	it("提交返回 false 时保留对话框，错误写在输入框下方并与它关联", () => {
		function WithValidation() {
			const [error, setError] = useState("");
			return (
				<RenameSeries
					error={error}
					onValueChange={() => setError("")}
					onConfirm={(value) => {
						if (value.trim()) return;
						setError("名称不能为空");
						return false;
					}}
				/>
			);
		}
		render(<WithValidation />);
		open();
		const field = screen.getByRole("textbox");
		fireEvent.change(field, { target: { value: "" } });
		fireEvent.click(screen.getByRole("button", { name: "保存" }));
		expect(dialog()).not.toBeNull();
		expect(field.getAttribute("aria-invalid")).toBe("true");
		expect(
			document.getElementById(field.getAttribute("aria-describedby") ?? "")?.textContent,
		).toBe("名称不能为空");
	});

	it("给出最多字数时显示字数", () => {
		render(<RenameSeries />);
		open();
		expect(screen.getByText("9 / 24")).toBeTruthy();
	});

	it("点遮罩与取消都关闭", async () => {
		render(<RenameSeries />);
		open();
		await settle();
		fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
		fireEvent.pointerUp(document.body, { pointerType: "mouse", button: 0 });
		fireEvent.click(document.body);
		expect(dialog()).toBeNull();
		open();
		fireEvent.click(screen.getByRole("button", { name: "取消" }));
		expect(dialog()).toBeNull();
	});

	it("多行输入时回车换行，⌘↵ 提交", () => {
		const onConfirm = vi.fn();
		render(<RenameSeries multiline label="B站 Cookie" defaultValue="" onConfirm={onConfirm} />);
		open();
		const field = screen.getByRole("textbox", { name: "B站 Cookie" });
		fireEvent.change(field, { target: { value: "SESSDATA=1" } });
		fireEvent.keyDown(field, { key: "Enter" });
		expect(onConfirm).not.toHaveBeenCalled();
		fireEvent.keyDown(field, { key: "Enter", metaKey: true });
		expect(onConfirm).toHaveBeenCalledWith("SESSDATA=1");
	});
});
