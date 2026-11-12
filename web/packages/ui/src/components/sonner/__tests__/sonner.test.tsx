import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "../sonner";

/**
 * 推进假时钟并让 sonner 的 setTimeout / rAF 排队的更新全部落地。
 * 分步推进：React 在一次 act 内不会提交效果，而关闭流程要「渲染 → 效果 → 再起计时」好几轮。
 */
const advance = async (ms: number) => {
	for (let left = ms; left > 0; left -= 100) {
		await act(() => vi.advanceTimersByTimeAsync(Math.min(100, left)));
	}
};
/** 发一条通知并等它进入通知区。 */
const show = async (publish: () => unknown) => {
	act(() => {
		publish();
	});
	await advance(20);
};
const present = (text: string) => screen.queryByText(text) !== null;

describe("Toaster", () => {
	beforeEach(() => {
		// sonner 的按 id 关闭经 requestAnimationFrame 派发，需要一并接管
		vi.useFakeTimers({
			toFake: [
				"setTimeout",
				"clearTimeout",
				"setInterval",
				"clearInterval",
				"Date",
				"requestAnimationFrame",
				"cancelAnimationFrame",
			],
		});
	});
	afterEach(async () => {
		act(() => {
			toast.dismiss();
		});
		await advance(1000);
		cleanup();
		vi.useRealTimers();
	});

	describe("区域与读屏", () => {
		it("通知区标为「通知（⌥T）」，是 section 地标", () => {
			render(<Toaster />);
			expect(screen.getByRole("region", { name: "通知（⌥T）" })).toBeTruthy();
		});

		it("换了热键就按热键拼标签，不再声称 ⌥T", () => {
			render(<Toaster hotkey={["altKey", "KeyJ"]} />);
			expect(screen.getByRole("region", { name: "通知 alt+J" })).toBeTruthy();
		});

		it("customAriaLabel 原样生效", () => {
			render(<Toaster customAriaLabel="回执" />);
			expect(screen.getByRole("region", { name: "回执" })).toBeTruthy();
		});

		it("通知区是礼貌的活动区域，新增的通知会被播报", () => {
			render(<Toaster />);
			const region = screen.getByRole("region", { name: "通知（⌥T）" });
			expect(region.getAttribute("aria-live")).toBe("polite");
			expect(region.getAttribute("aria-relevant")).toContain("additions");
		});

		it("⌥T 把焦点移进通知区", async () => {
			render(<Toaster />);
			await show(() => toast.success("已复制链接"));
			fireEvent.keyDown(document, { code: "KeyT", altKey: true });
			const list = screen.getByRole("region").querySelector("ol");
			expect(document.activeElement).toBe(list);
		});
	});

	describe("类型与图标", () => {
		it("四种结果类型各带一个不可见于读屏的图标", async () => {
			render(<Toaster />);
			await show(() => toast.success("已发布"));
			await show(() => toast.info("已切换到深色"));
			await show(() => toast.warning("还有 3 张图片没有替代文字"));
			await show(() => toast.error("发布失败"));
			for (const text of [
				"已发布",
				"已切换到深色",
				"还有 3 张图片没有替代文字",
				"发布失败",
			]) {
				const icon = screen.getByText(text).closest("li")?.querySelector("[data-icon] svg");
				expect(icon, text).toBeTruthy();
				expect(icon?.getAttribute("aria-hidden")).toBe("true");
			}
		});

		it("加载中用指示器的控件圆弧，装饰性隐藏", async () => {
			render(<Toaster />);
			await show(() => toast.loading("正在上传 3 张图片…"));
			const card = screen.getByText("正在上传 3 张图片…").closest("li");
			const spinner = card?.querySelector(".v-spinner");
			expect(spinner).toBeTruthy();
			expect(spinner?.getAttribute("aria-hidden")).toBe("true");
		});

		it("说明文字与标题分开渲染", async () => {
			render(<Toaster />);
			await show(() =>
				toast.error("发布失败", { description: "网络中断，草稿已保存在本地" }),
			);
			expect(present("发布失败")).toBe(true);
			expect(present("网络中断，草稿已保存在本地")).toBe(true);
		});
	});

	describe("操作与关闭", () => {
		it("点击操作触发回调并关闭这条通知", async () => {
			const undo = vi.fn();
			render(<Toaster />);
			await show(() =>
				toast.success("已删除 2 条评论", { action: { label: "撤销", onClick: undo } }),
			);
			fireEvent.click(screen.getByRole("button", { name: "撤销" }));
			expect(undo).toHaveBeenCalledTimes(1);
			await advance(300);
			expect(present("已删除 2 条评论")).toBe(false);
		});

		it("操作回调里 preventDefault 可以让通知留着", async () => {
			render(<Toaster />);
			await show(() =>
				toast("已删除 2 条评论", {
					action: { label: "撤销", onClick: (event) => event.preventDefault() },
				}),
			);
			fireEvent.click(screen.getByRole("button", { name: "撤销" }));
			await advance(300);
			expect(present("已删除 2 条评论")).toBe(true);
		});

		it("关闭钮常驻，带中文名，点击后移除并触发 onDismiss", async () => {
			const dismissed = vi.fn();
			render(<Toaster />);
			await show(() => toast.info("已切换到深色", { onDismiss: dismissed }));
			fireEvent.click(screen.getByRole("button", { name: "关闭" }));
			expect(dismissed).toHaveBeenCalledTimes(1);
			await advance(300);
			expect(present("已切换到深色")).toBe(false);
		});

		it("加载中的通知没有关闭钮，要等结果", async () => {
			render(<Toaster />);
			await show(() => toast.loading("正在上传 3 张图片…"));
			expect(screen.queryByRole("button", { name: "关闭" })).toBeNull();
		});

		it("toast.dismiss(id) 按 id 关闭一条，其余留着", async () => {
			render(<Toaster />);
			const first = toast.success("已发布");
			await show(() => toast.success("已复制"));
			act(() => {
				toast.dismiss(first);
			});
			await advance(600);
			expect(present("已发布")).toBe(false);
			expect(present("已复制")).toBe(true);
		});
	});

	describe("自动关闭时长", () => {
		it("成功与信息 4 秒", async () => {
			render(<Toaster />);
			await show(() => toast.success("已发布"));
			await show(() => toast.info("已切换到深色"));
			await advance(3500);
			expect(present("已发布")).toBe(true);
			await advance(1000);
			expect(present("已发布")).toBe(false);
			expect(present("已切换到深色")).toBe(false);
		});

		it("警告 6 秒", async () => {
			render(<Toaster />);
			await show(() => toast.warning("还有 3 张图片没有替代文字"));
			await advance(5000);
			expect(present("还有 3 张图片没有替代文字")).toBe(true);
			await advance(1500);
			expect(present("还有 3 张图片没有替代文字")).toBe(false);
		});

		it("带操作 8 秒", async () => {
			render(<Toaster />);
			await show(() =>
				toast.success("已删除 2 条评论", { action: { label: "撤销", onClick: () => {} } }),
			);
			await advance(7000);
			expect(present("已删除 2 条评论")).toBe(true);
			await advance(1500);
			expect(present("已删除 2 条评论")).toBe(false);
		});

		it("出错不自动关", async () => {
			render(<Toaster />);
			await show(() => toast.error("发布失败"));
			await advance(60_000);
			expect(present("发布失败")).toBe(true);
		});

		it("加载中不自动关", async () => {
			render(<Toaster />);
			await show(() => toast.loading("正在上传 3 张图片…"));
			await advance(60_000);
			expect(present("正在上传 3 张图片…")).toBe(true);
		});

		it("调用方显式给的 duration 优先，出错也照它关", async () => {
			render(<Toaster />);
			await show(() => toast.error("发布失败", { duration: 2000 }));
			await show(() => toast.warning("磁盘快满了", { duration: 10_000 }));
			await advance(2500);
			expect(present("发布失败")).toBe(false);
			await advance(7000);
			expect(present("磁盘快满了")).toBe(true);
		});

		it("同 id 更新为另一种类型时按新类型重新定时", async () => {
			render(<Toaster />);
			await show(() => toast.error("发布失败", { id: "publish" }));
			await advance(10_000);
			expect(present("发布失败")).toBe(true);
			await show(() => toast.success("已重新发布", { id: "publish" }));
			await advance(4500);
			expect(present("已重新发布")).toBe(false);
		});

		it("指针移入通知区时计时停住，离开后继续", async () => {
			render(<Toaster />);
			await show(() => toast.success("已发布"));
			await show(() => toast.success("已复制"));
			const list = screen.getByRole("region").querySelector("ol") as HTMLElement;
			fireEvent.mouseEnter(list);
			await advance(20_000);
			expect(present("已发布")).toBe(true);
			fireEvent.mouseLeave(list);
			await advance(4500);
			expect(present("已发布")).toBe(false);
		});

		it("已经关闭的通知不会被时长补写复活", async () => {
			render(<Toaster />);
			const id = toast.error("发布失败");
			act(() => {
				toast.dismiss(id);
			});
			await advance(1000);
			expect(present("发布失败")).toBe(false);
		});
	});

	describe("数量上限", () => {
		it("同时最多保留 6 条，超出时最早的一条被移除", async () => {
			render(<Toaster />);
			for (let n = 1; n <= 7; n++) await show(() => toast.error(`第 ${n} 条`));
			await advance(1000);
			expect(present("第 1 条")).toBe(false);
			for (let n = 2; n <= 7; n++) expect(present(`第 ${n} 条`), `第 ${n} 条`).toBe(true);
			expect(toast.getToasts()).toHaveLength(6);
		});
	});

	describe("加载变成结果", () => {
		it("toast.promise：同一张卡原地变成成功，图标换成结果图标", async () => {
			let finish: (value: string) => void = () => {};
			const pending = new Promise<string>((resolve) => {
				finish = resolve;
			});
			render(<Toaster />);
			await show(() =>
				toast.promise(pending, {
					loading: "正在上传 3 张图片…",
					success: "已上传 3 张图片",
				}),
			);
			const card = screen.getByText("正在上传 3 张图片…").closest("li");
			expect(card?.querySelector(".v-spinner")).toBeTruthy();

			await act(async () => {
				finish("ok");
				await vi.advanceTimersByTimeAsync(50);
			});
			expect(present("正在上传 3 张图片…")).toBe(false);
			expect(screen.getByText("已上传 3 张图片").closest("li")).toBe(card);
			expect(card?.querySelector("[data-icon] .v-toast__tick")).toBeTruthy();
		});

		it("成功的结果按 4 秒收起", async () => {
			render(<Toaster />);
			await show(() =>
				toast.promise(Promise.resolve("ok"), { loading: "上传中", success: "已上传" }),
			);
			await advance(3500);
			expect(present("已上传")).toBe(true);
			await advance(1000);
			expect(present("已上传")).toBe(false);
		});

		it("失败的结果原地变成出错，并且不自动关", async () => {
			render(<Toaster />);
			await show(() =>
				toast.promise(Promise.reject(new Error("502")), {
					loading: "上传中",
					error: "上传失败",
				}),
			);
			await advance(60_000);
			expect(present("上传失败")).toBe(true);
			expect(screen.getAllByRole("button", { name: "关闭" })).toHaveLength(1);
		});

		it("同 id 的 loading 更新成 success 也是原地变化", async () => {
			render(<Toaster />);
			await show(() => toast.loading("正在保存", { id: "save" }));
			const card = screen.getByText("正在保存").closest("li");
			await show(() => toast.success("已保存", { id: "save" }));
			expect(screen.getByText("已保存").closest("li")).toBe(card);
		});
	});

	describe("多个通知区", () => {
		it("带 toasterId 的通知只出现在对应 id 的通知区", async () => {
			render(
				<>
					<Toaster />
					<Toaster id="stage" containerAriaLabel="舞台通知" customAriaLabel="舞台通知" />
				</>,
			);
			await show(() => toast.success("站点通知"));
			await show(() => toast.success("舞台通知内容", { toasterId: "stage" }));

			const root = screen.getByRole("region", { name: "通知（⌥T）" });
			const stage = screen.getByRole("region", { name: "舞台通知" });
			expect(root.textContent).toContain("站点通知");
			expect(root.textContent).not.toContain("舞台通知内容");
			expect(stage.textContent).toContain("舞台通知内容");
			expect(stage.textContent).not.toContain("站点通知");
		});

		it("各通知区各自应用时长与上限策略", async () => {
			render(
				<>
					<Toaster />
					<Toaster id="stage" customAriaLabel="舞台" />
				</>,
			);
			await show(() => toast.error("舞台出错", { toasterId: "stage" }));
			await advance(60_000);
			expect(present("舞台出错")).toBe(true);
		});
	});

	describe("类名与样式契约", () => {
		it("卡片与部件带稳定的 BEM 类名，调用方的 className 追加其后", async () => {
			render(<Toaster toastOptions={{ classNames: { toast: "host-toast" } }} />);
			await show(() => toast.success("已发布", { description: "独库公路，六天" }));
			const card = screen.getByText("已发布").closest("li");
			expect(card?.classList.contains("v-toast")).toBe(true);
			expect(card?.classList.contains("v-toast--success")).toBe(true);
			expect(card?.classList.contains("host-toast")).toBe(true);
			expect(card?.querySelector(".v-toast__title")).toBeTruthy();
			expect(card?.querySelector(".v-toast__description")).toBeTruthy();
			expect(card?.querySelector(".v-toast__close")).toBeTruthy();
		});

		it("容器带 .v-toaster，层级压在 --layer-toast", async () => {
			render(<Toaster />);
			await show(() => toast.success("已发布"));
			const list = screen.getByRole("region").querySelector("ol") as HTMLElement;
			expect(list.classList.contains("v-toaster")).toBe(true);
			expect(list.style.zIndex).toBe("var(--layer-toast)");
		});
	});
});
