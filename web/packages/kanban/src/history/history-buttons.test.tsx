import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createHistory, type HistoryCommand } from "../core/index.ts";
import { HistoryButtons } from "./history-buttons.tsx";
import { useHistoryAnnouncement } from "./use-history-announcement.ts";
import { useHistoryState } from "./use-history-state.ts";

const command = (name: string, overrides: Partial<HistoryCommand> = {}): HistoryCommand => ({
	label: name,
	undo: () => {},
	redo: () => {},
	...overrides,
});

const announced = () => document.querySelector(".v-kanban-history__announcer")?.textContent;
const button = (name: string) => screen.getByRole("button", { name });
const unavailable = (element: HTMLElement) => element.getAttribute("aria-disabled") === "true";

describe("HistoryButtons", () => {
	it("没有历史时两个按钮都不可用，但仍可聚焦（不用 disabled）", () => {
		render(<HistoryButtons history={createHistory()} />);

		for (const name of ["Undo", "Redo"]) {
			expect(unavailable(button(name))).toBe(true);
			expect(button(name).hasAttribute("disabled")).toBe(false);
		}
	});

	it("有可撤销的步骤时可用：可访问名称就是可见文字，下一步的名称放在 title，并声明快捷键", () => {
		const history = createHistory();
		render(<HistoryButtons history={history} />);

		act(() => history.push(command("move #12")));

		const undo = button("Undo");
		expect(unavailable(undo)).toBe(false);
		expect(undo.textContent).toBe("Undo");
		expect(undo.getAttribute("title")).toBe("Undo move #12");
		expect(undo.getAttribute("aria-keyshortcuts")).toBe("Control+Z Meta+Z");
		expect(unavailable(button("Redo"))).toBe(true);
		expect(button("Redo").getAttribute("aria-keyshortcuts")).toBe(
			"Control+Shift+Z Meta+Shift+Z Control+Y",
		);
	});

	it("不可用时点击不执行任何操作", async () => {
		const undo = vi.fn();
		const history = createHistory();
		render(<HistoryButtons history={history} />);

		await act(async () => fireEvent.click(button("Undo")));
		await act(async () => fireEvent.click(button("Redo")));
		act(() => history.push(command("a", { undo })));
		await act(async () => fireEvent.click(button("Redo")));

		expect(undo).not.toHaveBeenCalled();
		expect(unavailable(button("Undo"))).toBe(false);
	});

	it("点击撤销执行反向操作，随后重做可用并播报结果", async () => {
		const undo = vi.fn();
		const history = createHistory();
		history.push(command("move #12", { undo }));
		render(<HistoryButtons history={history} />);

		await act(async () => fireEvent.click(button("Undo")));

		expect(undo).toHaveBeenCalledTimes(1);
		expect(unavailable(button("Redo"))).toBe(false);
		expect(button("Redo").getAttribute("title")).toBe("Redo move #12");
		expect(announced()).toBe("Undone: move #12.");
	});

	it("点击重做执行正向操作并播报", async () => {
		const redo = vi.fn();
		const history = createHistory();
		history.push(command("edit", { redo }));
		await history.undo();
		render(<HistoryButtons history={history} />);

		await act(async () => fireEvent.click(button("Redo")));

		expect(redo).toHaveBeenCalledTimes(1);
		expect(announced()).toBe("Redone: edit.");
	});

	it("撤销失败：该步作废、按钮回到不可用，并播报失败", async () => {
		const history = createHistory();
		history.push(command("move", { undo: () => Promise.reject(new Error("no")) }));
		render(<HistoryButtons history={history} />);

		await act(async () => fireEvent.click(button("Undo")));

		expect(announced()).toBe("Couldn't undo. That step was discarded.");
		expect(unavailable(button("Undo"))).toBe(true);
		expect(unavailable(button("Redo"))).toBe(true);
	});

	it("撤销进行中两个按钮都不可用", async () => {
		let release: () => void = () => {};
		const history = createHistory();
		history.push(
			command("slow", {
				undo: () =>
					new Promise<void>((resolve) => {
						release = resolve;
					}),
			}),
		);
		render(<HistoryButtons history={history} />);

		act(() => {
			void history.undo();
		});
		expect(unavailable(button("Undo"))).toBe(true);
		expect(unavailable(button("Redo"))).toBe(true);
		await act(async () => release());

		expect(unavailable(button("Redo"))).toBe(false);
	});

	it("撤销完最后一步后焦点仍留在撤销按钮上", async () => {
		const history = createHistory();
		history.push(command("only"));
		render(<HistoryButtons history={history} />);
		button("Undo").focus();

		await act(async () => fireEvent.click(button("Undo")));

		expect(unavailable(button("Undo"))).toBe(true);
		expect(document.activeElement).toBe(button("Undo"));
	});

	it("zh-CN 与 messages 覆盖：覆盖后可访问名称仍是可见文字", async () => {
		const history = createHistory();
		history.push(command("移动 #3"));
		const view = render(<HistoryButtons history={history} locale="zh-CN" />);

		expect(screen.getByRole("group", { name: "历史" })).toBeTruthy();
		expect(button("撤销").getAttribute("title")).toBe("撤销移动 #3");
		await act(async () => fireEvent.click(button("撤销")));
		expect(announced()).toBe("已撤销：移动 #3。");
		view.unmount();

		const other = createHistory();
		other.push(command("move A"));
		render(<HistoryButtons history={other} messages={{ undo: "Back" }} />);
		expect(button("Back").textContent).toBe("Back");
	});

	it("服务端渲染不报错，两个按钮不可用", () => {
		const html = renderToString(<HistoryButtons history={createHistory()} />);

		expect(html.match(/aria-disabled="true"/g)?.length).toBe(2);
	});
});

describe("useHistoryAnnouncement", () => {
	function Probe({
		history,
		locale,
	}: {
		history: ReturnType<typeof createHistory>;
		locale?: "zh-CN";
	}) {
		const { text, seq } = useHistoryAnnouncement(history, { locale });
		return <output data-seq={seq}>{text}</output>;
	}
	const probe = () => screen.getByRole("status");

	it("不渲染按钮也能拿到撤销、重做的结果文本，失败时说明这一步已作废", async () => {
		const history = createHistory();
		history.push(command("a"));
		history.push(command("b", { undo: () => Promise.reject(new Error("no")) }));
		render(<Probe history={history} />);
		expect(probe().textContent).toBe("");

		await act(async () => void (await history.undo()));
		expect(probe().textContent).toBe("Couldn't undo. That step was discarded.");

		await act(async () => void (await history.undo()));
		expect(probe().textContent).toBe("Undone: a.");
		await act(async () => void (await history.redo()));
		expect(probe().textContent).toBe("Redone: a.");
	});

	it("每次结果 seq 都变化，相同的文本也能被重新播报；支持 zh-CN", async () => {
		const history = createHistory();
		history.push(command("a"));
		history.push(command("a"));
		render(<Probe history={history} locale="zh-CN" />);

		await act(async () => void (await history.undo()));
		const first = probe().getAttribute("data-seq");
		await act(async () => void (await history.undo()));

		expect(probe().textContent).toBe("已撤销：a。");
		expect(probe().getAttribute("data-seq")).not.toBe(first);
	});
});

describe("useHistoryState", () => {
	it("历史变化时组件重新渲染", () => {
		const history = createHistory();
		function Probe() {
			const state = useHistoryState(history);
			return <output>{String(state.canUndo)}</output>;
		}
		render(<Probe />);
		expect(screen.getByRole("status").textContent).toBe("false");

		act(() => history.push(command("a")));

		expect(screen.getByRole("status").textContent).toBe("true");
	});
});
