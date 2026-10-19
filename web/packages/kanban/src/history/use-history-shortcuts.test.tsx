import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { type CommandHistory, createHistory, type HistoryCommand } from "../core/index.ts";
import { useHistoryShortcuts } from "./use-history-shortcuts.ts";

const command = (name: string, overrides: Partial<HistoryCommand> = {}): HistoryCommand => ({
	label: name,
	undo: () => {},
	redo: () => {},
	...overrides,
});

function Harness({
	history,
	enabled,
	scoped,
}: {
	history: CommandHistory;
	enabled?: boolean;
	scoped?: boolean;
}) {
	const scope = useRef<HTMLDivElement>(null);
	useHistoryShortcuts(history, { enabled, scope: scoped ? scope : undefined });
	return (
		<div ref={scope} data-testid="scope">
			<input aria-label="field" />
			<textarea aria-label="area" />
			<select aria-label="choice">
				<option>a</option>
			</select>
			<div
				contentEditable
				suppressContentEditableWarning
				role="textbox"
				tabIndex={0}
				aria-label="rich"
			/>
			<button type="button">plain</button>
		</div>
	);
}

const setup = (props: { enabled?: boolean; scoped?: boolean } = {}) => {
	const undo = vi.fn();
	const redo = vi.fn();
	const history = createHistory();
	history.push(command("a", { undo, redo }));
	render(<Harness history={history} {...props} />);
	return { history, undo, redo };
};

const press = (init: KeyboardEventInit, target: EventTarget = document.body) => {
	const event = new KeyboardEvent("keydown", {
		bubbles: true,
		cancelable: true,
		composed: true,
		...init,
	});
	act(() => {
		target.dispatchEvent(event);
	});
	return event;
};

describe("useHistoryShortcuts", () => {
	it("Ctrl+Z 撤销，并阻止浏览器自己的撤销", async () => {
		const { undo } = setup();

		const event = press({ key: "z", ctrlKey: true });
		await act(async () => {});

		expect(undo).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it("⌘+Z 同样撤销", async () => {
		const { undo } = setup();

		press({ key: "z", metaKey: true });
		await act(async () => {});

		expect(undo).toHaveBeenCalledTimes(1);
	});

	it("Ctrl+Shift+Z、⌘+Shift+Z 与 Ctrl+Y 重做，⌘+Y 不是重做", async () => {
		const { history, redo } = setup();
		await act(async () => void (await history.undo()));

		for (const init of [
			{ key: "Z", ctrlKey: true, shiftKey: true },
			{ key: "Z", metaKey: true, shiftKey: true },
			{ key: "y", ctrlKey: true },
		]) {
			press(init);
			await act(async () => {});
			await act(async () => void (await history.undo()));
		}
		expect(redo).toHaveBeenCalledTimes(3);

		press({ key: "y", metaKey: true });
		await act(async () => {});
		expect(redo).toHaveBeenCalledTimes(3);
	});

	it("在输入控件、文本域、选择器与可编辑文本内不拦截", async () => {
		const { undo } = setup();

		for (const label of ["field", "area", "choice", "rich"]) {
			const event = press({ key: "z", ctrlKey: true }, screen.getByLabelText(label));
			expect(event.defaultPrevented).toBe(false);
		}
		await act(async () => {});

		expect(undo).not.toHaveBeenCalled();
	});

	it("Shadow DOM 里的输入框同样不拦截，事件来源取 composedPath 的第一项", async () => {
		const { undo } = setup();
		const host = document.createElement("div");
		document.body.append(host);
		const input = document.createElement("input");
		host.attachShadow({ mode: "open" }).append(input);

		const event = press({ key: "z", ctrlKey: true }, input);
		await act(async () => {});

		expect(event.defaultPrevented).toBe(false);
		expect(undo).not.toHaveBeenCalled();
	});

	it("单独的 Z、带 Alt、输入法组合期间、已被处理的事件都不触发", async () => {
		const { undo } = setup();

		press({ key: "z" });
		press({ key: "z", ctrlKey: true, altKey: true });
		press({ key: "z", ctrlKey: true, isComposing: true });
		const handled = new KeyboardEvent("keydown", {
			key: "z",
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
		});
		handled.preventDefault();
		act(() => void document.body.dispatchEvent(handled));
		await act(async () => {});

		expect(undo).not.toHaveBeenCalled();
	});

	it("enabled 为 false 时不监听", async () => {
		const { undo } = setup({ enabled: false });

		press({ key: "z", ctrlKey: true });
		await act(async () => {});

		expect(undo).not.toHaveBeenCalled();
	});

	it("卸载后移除监听", async () => {
		const undo = vi.fn();
		const history = createHistory();
		history.push(command("a", { undo }));
		const view = render(<Harness history={history} />);

		view.unmount();
		press({ key: "z", ctrlKey: true });
		await act(async () => {});

		expect(undo).not.toHaveBeenCalled();
	});

	it("可限定在某个元素内：元素外的按键不触发", async () => {
		const { undo } = setup({ scoped: true });

		press({ key: "z", ctrlKey: true }, document.body);
		await act(async () => {});
		expect(undo).not.toHaveBeenCalled();

		press({ key: "z", ctrlKey: true }, screen.getByRole("button", { name: "plain" }));
		await act(async () => {});
		expect(undo).toHaveBeenCalledTimes(1);
	});

	it("给了 scope 但元素还没有挂载时不监听，而不是退回到整个页面", async () => {
		const undo = vi.fn();
		const history = createHistory();
		history.push(command("a", { undo }));
		function Detached() {
			const scope = useRef<HTMLDivElement>(null);
			useHistoryShortcuts(history, { scope });
			return null;
		}
		render(<Detached />);

		press({ key: "z", ctrlKey: true });
		await act(async () => {});

		expect(undo).not.toHaveBeenCalled();
	});
});
