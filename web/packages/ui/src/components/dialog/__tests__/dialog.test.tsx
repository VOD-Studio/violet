import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../../button";
import {
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../dialog";
import { Modal } from "../modal";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	Reflect.deleteProperty(HTMLElement.prototype, "animate");
});

/** Radix 在宏任务里才登记外部按下监听，也在宏任务里归还焦点。 */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const pressOn = async (target: Element) => {
	await settle();
	fireEvent.pointerDown(target, { pointerType: "mouse", button: 0 });
	fireEvent.pointerUp(target, { pointerType: "mouse", button: 0 });
	fireEvent.click(target);
};
/** 对话框打开时背后的内容对读屏隐藏，触发器要带上 hidden 才查得到。 */
const triggerButton = () => screen.getByRole("button", { name: "编辑资料", hidden: true });
const dialog = () => screen.queryByRole("dialog");
const focused = () => document.activeElement;
/** aria-describedby 指向的说明文字。 */
const description = (element: HTMLElement) =>
	document.getElementById(element.getAttribute("aria-describedby") ?? "")?.textContent;

function ProfileDialog({
	dirty = false,
	withField = true,
	...props
}: { dirty?: boolean; withField?: boolean } & Partial<Parameters<typeof DialogContent>[0]>) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="secondary">编辑资料</Button>
			</DialogTrigger>
			<DialogContent dirty={dirty} {...props}>
				<DialogHeader>
					<DialogTitle>编辑资料</DialogTitle>
					<DialogDescription>名字和简介会显示在你的评论旁边</DialogDescription>
				</DialogHeader>
				<DialogBody>
					{withField ? <input aria-label="昵称" defaultValue="林间" /> : <p>2.22.1</p>}
				</DialogBody>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="secondary">取消</Button>
					</DialogClose>
					<Button>保存</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

describe("Dialog", () => {
	it("以标题命名、以说明描述，焦点落到第一个输入框", () => {
		render(<ProfileDialog />);
		fireEvent.click(screen.getByRole("button", { name: "编辑资料" }));
		const panel = screen.getByRole("dialog", { name: "编辑资料" });
		expect(description(panel)).toBe("名字和简介会显示在你的评论旁边");
		expect(focused()).toBe(screen.getByRole("textbox", { name: "昵称" }));
	});

	it("没有输入框时焦点落到底栏最右的主按钮", () => {
		render(<ProfileDialog withField={false} />);
		fireEvent.click(screen.getByRole("button", { name: "编辑资料" }));
		expect(focused()).toBe(screen.getByRole("button", { name: "保存" }));
	});

	it("Tab 只在框内循环", () => {
		render(<ProfileDialog />);
		fireEvent.click(screen.getByRole("button", { name: "编辑资料" }));
		const save = screen.getByRole("button", { name: "保存" });
		save.focus();
		fireEvent.keyDown(save, { key: "Tab" });
		expect(focused()).toBe(screen.getByRole("button", { name: "关闭" }));
	});

	it.each([
		[
			"Esc",
			() => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" }),
		],
		["关闭按钮", () => fireEvent.click(screen.getByRole("button", { name: "关闭" }))],
		["取消", () => fireEvent.click(screen.getByRole("button", { name: "取消" }))],
	])("%s 关闭后焦点回到打开它的按钮", async (_, close) => {
		render(<ProfileDialog />);
		const trigger = triggerButton();
		fireEvent.click(trigger);
		close();
		expect(dialog()).toBeNull();
		await waitFor(() => expect(focused()).toBe(trigger));
	});

	it("点遮罩关闭；遮罩不着色时点外面同样关闭", async () => {
		for (const overlay of [true, false]) {
			render(<ProfileDialog overlay={overlay} />);
			fireEvent.click(screen.getByRole("button", { name: "编辑资料" }));
			await pressOn(document.body);
			expect(dialog()).toBeNull();
			cleanup();
		}
	});

	it("框里的选择器、弹出层点选不关闭对话框", async () => {
		render(<ProfileDialog />);
		fireEvent.click(screen.getByRole("button", { name: "编辑资料" }));
		const floating = document.createElement("div");
		floating.setAttribute("data-radix-popper-content-wrapper", "");
		const option = document.createElement("button");
		floating.append(option);
		document.body.append(floating);
		await pressOn(option);
		expect(dialog()).not.toBeNull();
		floating.remove();
	});

	it("受控打开时焦点回到打开前聚焦的元素", async () => {
		function Controlled() {
			const [open, setOpen] = useState(false);
			return (
				<>
					<button type="button" onClick={() => setOpen(true)}>
						更新日志
					</button>
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogContent aria-describedby={undefined}>
							<DialogHeader>
								<DialogTitle>更新日志</DialogTitle>
							</DialogHeader>
							<DialogBody>2.22.1</DialogBody>
							<DialogFooter>
								<DialogClose asChild>
									<Button>知道了</Button>
								</DialogClose>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</>
			);
		}
		render(<Controlled />);
		const opener = screen.getByRole("button", { name: "更新日志" });
		opener.focus();
		fireEvent.click(opener);
		expect(focused()).toBe(screen.getByRole("button", { name: "知道了" }));
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		expect(dialog()).toBeNull();
		await waitFor(() => expect(focused()).toBe(opener));
	});

	describe("有未保存的修改", () => {
		const open = () => {
			render(<ProfileDialog dirty />);
			fireEvent.click(triggerButton());
		};
		const pressEscape = () =>
			fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

		it("Esc 先在底栏询问，焦点落到继续编辑", () => {
			open();
			pressEscape();
			expect(dialog()).not.toBeNull();
			expect(screen.getByRole("status").textContent).toBe("有未保存的修改，要放弃吗？");
			expect(focused()).toBe(screen.getByRole("button", { name: "继续编辑" }));
			expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
		});

		it("继续编辑收起询问并把焦点还给原来的字段", () => {
			open();
			pressEscape();
			fireEvent.click(screen.getByRole("button", { name: "继续编辑" }));
			expect(screen.queryByRole("status")).toBeNull();
			expect(focused()).toBe(screen.getByRole("textbox", { name: "昵称" }));
		});

		it("放弃修改或再请求一次关闭都会关掉", () => {
			open();
			fireEvent.click(screen.getByRole("button", { name: "关闭" }));
			fireEvent.click(screen.getByRole("button", { name: "放弃修改" }));
			expect(dialog()).toBeNull();
			cleanup();
			open();
			pressEscape();
			pressEscape();
			expect(dialog()).toBeNull();
		});
	});

	it("尺寸只有四档，默认为中", () => {
		const { rerender } = render(
			<Dialog open>
				<DialogContent aria-describedby={undefined}>
					<DialogTitle>新建标签</DialogTitle>
				</DialogContent>
			</Dialog>,
		);
		expect(dialog()?.className).toContain("v-dialog v-dialog--md");
		rerender(
			<Dialog open>
				<DialogContent size="xl" aria-describedby={undefined}>
					<DialogTitle>新建标签</DialogTitle>
				</DialogContent>
			</Dialog>,
		);
		expect(dialog()?.classList.contains("v-dialog--xl")).toBe(true);
	});

	it("有触发按钮且能播放动画时从按钮展开，期间藏起按钮", () => {
		const animate = vi.fn(() => ({ finished: Promise.resolve() }) as unknown as Animation);
		Object.defineProperty(HTMLElement.prototype, "animate", {
			value: animate,
			configurable: true,
		});
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
			new DOMRect(0, 0, 120, 36),
		);
		render(<ProfileDialog />);
		const trigger = triggerButton();
		fireEvent.click(trigger);
		expect(dialog()?.getAttribute("data-entrance")).toBe("expand");
		expect(trigger?.getAttribute("data-dialog-origin")).toBe("hidden");
		expect(animate).toHaveBeenCalledTimes(1);
	});

	it("没有触发按钮或指定落位时落位", () => {
		render(<ProfileDialog entrance="settle" />);
		fireEvent.click(triggerButton());
		expect(dialog()?.getAttribute("data-entrance")).toBe("settle");
		expect(triggerButton().hasAttribute("data-dialog-origin")).toBe(false);
	});
});

describe("Modal", () => {
	it("用属性组成三段式对话框", () => {
		render(
			<Modal
				open
				onOpenChange={() => {}}
				title="新建角色"
				description="角色决定后台能看到的菜单"
				footer={<Button>创建</Button>}
			>
				<input aria-label="名称" />
			</Modal>,
		);
		const panel = screen.getByRole("dialog", { name: "新建角色" });
		expect(description(panel)).toBe("角色决定后台能看到的菜单");
		expect(
			panel
				.querySelector("[data-slot='dialog-body']")
				?.contains(screen.getByRole("textbox", { name: "名称" })),
		).toBe(true);
		expect(screen.getByRole("button", { name: "创建" }).parentElement?.dataset.slot).toBe(
			"dialog-footer",
		);
	});

	it("标题只给读屏时仍为对话框命名", () => {
		render(
			<Modal open onOpenChange={() => {}} title="媒体查看器" titleSrOnly unstyled>
				<p>cover.webp</p>
			</Modal>,
		);
		expect(
			screen
				.getByRole("dialog", { name: "媒体查看器" })
				?.classList.contains("v-dialog--bare"),
		).toBe(true);
	});
});
