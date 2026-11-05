import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
	Sheet,
	SheetBody,
	SheetContent,
	type SheetContentProps,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "../sheet";

function FilterSheet({ modal, ...props }: Partial<SheetContentProps> & { modal?: boolean }) {
	return (
		<>
			<button type="button">页面上的按钮</button>
			<Sheet modal={modal}>
				<SheetTrigger>筛选</SheetTrigger>
				<SheetContent aria-describedby={undefined} {...props}>
					<SheetHeader>
						<SheetTitle>筛选</SheetTitle>
					</SheetHeader>
					<SheetBody>
						<button type="button">骑行</button>
					</SheetBody>
				</SheetContent>
			</Sheet>
		</>
	);
}

const panel = () => screen.queryByRole("dialog");
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const open = () => {
	const trigger = screen.getByRole("button", { name: "筛选" });
	trigger.focus();
	fireEvent.click(trigger);
	return trigger;
};
const pressOn = async (target: Element) => {
	await settle();
	fireEvent.pointerDown(target, { pointerType: "mouse", button: 0 });
	fireEvent.pointerUp(target, { pointerType: "mouse", button: 0 });
	fireEvent.click(target);
};

describe("Sheet", () => {
	it("有遮罩时是模态对话框，焦点落到标题栏后的第一个控件", () => {
		render(<FilterSheet />);
		open();
		const dialog = screen.getByRole("dialog", { name: "筛选" });
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "骑行" }));
	});

	it("Esc、关闭按钮与点遮罩都关闭，焦点回到打开它的按钮", async () => {
		render(<FilterSheet />);
		const trigger = open();
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		expect(panel()).toBeNull();
		await waitFor(() => expect(document.activeElement).toBe(trigger));
		open();
		fireEvent.click(screen.getByRole("button", { name: "关闭" }));
		expect(panel()).toBeNull();
		open();
		await pressOn(document.body);
		expect(panel()).toBeNull();
	});

	it("无遮罩时点页面、聚焦页面都不关闭，F6 在面板与页面之间跳转", async () => {
		render(<FilterSheet modal={false} />);
		const trigger = open();
		const dialog = screen.getByRole("dialog", { name: "筛选" });
		expect(dialog.getAttribute("aria-modal")).toBe("false");
		const pageButton = screen.getByRole("button", { name: "页面上的按钮" });
		await pressOn(pageButton);
		pageButton.focus();
		expect(panel()).not.toBeNull();
		fireEvent.keyDown(document, { key: "F6" });
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "骑行" }));
		fireEvent.keyDown(document, { key: "F6" });
		expect(document.activeElement).toBe(trigger);
	});

	it("已打开时换内容只交叉淡化，面板不重新滑入", () => {
		function Details() {
			const [row, setRow] = useState("独库公路，六天");
			return (
				<Sheet modal={false} defaultOpen>
					<SheetContent contentKey={row} aria-describedby={undefined}>
						<SheetHeader>
							<SheetTitle>{row}</SheetTitle>
						</SheetHeader>
						<SheetBody>
							<button type="button" onClick={() => setRow("秋天的桂花酿")}>
								下一篇
							</button>
						</SheetBody>
					</SheetContent>
				</Sheet>
			);
		}
		render(<Details />);
		const dialog = screen.getByRole("dialog", { name: "独库公路，六天" });
		expect(dialog.hasAttribute("data-swap")).toBe(false);
		fireEvent.click(screen.getByRole("button", { name: "下一篇" }));
		expect(screen.getByRole("dialog", { name: "秋天的桂花酿" })).toBe(dialog);
		expect(dialog.getAttribute("data-swap")).toBe("odd");
	});

	it("宽度三档、左右两侧，默认右侧中档", () => {
		render(
			<Sheet open>
				<SheetContent aria-describedby={undefined}>
					<SheetTitle>筛选</SheetTitle>
				</SheetContent>
			</Sheet>,
		);
		const dialog = screen.getByRole("dialog");
		expect(dialog.className).toContain("v-sheet--md");
		expect(dialog.getAttribute("data-side")).toBe("right");
	});
});
