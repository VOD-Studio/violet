import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NumberInput } from "../number-input";

const field = () => screen.getByRole<HTMLInputElement>("spinbutton", { name: "数量" });

afterEach(() => {
	vi.useRealTimers();
});

describe("NumberInput 草稿与提交", () => {
	it("不完整草稿通过原生 onChange 传出，Esc 放弃，Enter 规范化", () => {
		const drafts: string[] = [];
		const commit = vi.fn();
		render(
			<NumberInput
				aria-label="数量"
				defaultValue={5}
				onChange={(e) => drafts.push(e.currentTarget.value)}
				onValueCommit={commit}
			/>,
		);
		field().focus();
		expect(field().selectionStart).toBe(0);
		expect(field().selectionEnd).toBe(1);
		fireEvent.change(field(), { target: { value: "-" } });
		expect(field().value).toBe("-");
		expect(commit).not.toHaveBeenCalled();
		fireEvent.keyDown(field(), { key: "Escape" });
		expect(field().value).toBe("5");
		fireEvent.change(field(), { target: { value: "1." } });
		fireEvent.keyDown(field(), { key: "Enter" });
		expect(field().value).toBe("1");
		expect(drafts).toEqual(["-", "5", "1.", "1"]);
		expect(commit).toHaveBeenCalledExactlyOnceWith(1);
	});

	it("范围外草稿即刻标错，blur 夹范围并让原生 change 和 blur 看到最终值", () => {
		const events: string[] = [];
		render(
			<NumberInput
				aria-label="数量"
				defaultValue={5}
				min={0}
				max={100}
				onChange={(e) => events.push(`change:${e.currentTarget.value}`)}
				onBlur={(e) => events.push(`blur:${e.currentTarget.value}`)}
			/>,
		);
		fireEvent.change(field(), { target: { value: "120" } });
		expect(field().getAttribute("aria-invalid")).toBe("true");
		fireEvent.blur(field());
		expect(field().value).toBe("100");
		expect(events).toEqual(["change:120", "change:100", "blur:100"]);
		expect(screen.getByRole<HTMLButtonElement>("button", { name: "增加" }).disabled).toBe(true);
	});

	it("非法文本恢复上次提交值，空白是否提交由 allowEmpty 决定", () => {
		const commit = vi.fn();
		const { rerender } = render(
			<NumberInput aria-label="数量" defaultValue={7} onValueCommit={commit} />,
		);
		fireEvent.change(field(), { target: { value: "1..2" } });
		fireEvent.blur(field());
		expect(field().value).toBe("7");
		fireEvent.change(field(), { target: { value: "" } });
		fireEvent.blur(field());
		expect(field().value).toBe("");
		expect(commit).toHaveBeenCalledExactlyOnceWith(null);
		rerender(
			<NumberInput key="required" aria-label="数量" defaultValue={7} allowEmpty={false} />,
		);
		fireEvent.change(field(), { target: { value: "" } });
		fireEvent.blur(field());
		expect(field().value).toBe("7");
	});

	it("无初值且不允许空时以 min 或 0 恢复；空白步进从 min 或 0 计算", () => {
		const { rerender } = render(<NumberInput aria-label="数量" min={5} allowEmpty={false} />);
		fireEvent.blur(field());
		expect(field().value).toBe("5");
		rerender(<NumberInput key="empty" aria-label="数量" min={5} step={2} />);
		fireEvent.keyDown(field(), { key: "ArrowUp" });
		expect(field().value).toBe("7");
		rerender(<NumberInput key="zero" aria-label="数量" />);
		fireEvent.keyDown(field(), { key: "ArrowDown" });
		expect(field().value).toBe("-1");
	});

	it("step 推导小数精度，显式 precision 控制四舍五入，连续 0.1 不留浮点尾巴", () => {
		const { rerender } = render(<NumberInput aria-label="数量" defaultValue={0} step={0.1} />);
		for (let i = 0; i < 3; i++) fireEvent.keyDown(field(), { key: "ArrowUp" });
		expect(field().value).toBe("0.3");
		fireEvent.keyDown(field(), { key: "ArrowDown", shiftKey: true });
		expect(field().value).toBe("-0.7");
		rerender(<NumberInput key="precision" aria-label="数量" step={0.5} precision={2} />);
		fireEvent.change(field(), { target: { value: "1.005" } });
		fireEvent.blur(field());
		expect(field().value).toBe("1.01");
		rerender(<NumberInput key="scientific" aria-label="数量" step={1e-7} />);
		fireEvent.keyDown(field(), { key: "ArrowUp" });
		expect(field().value).toBe("0.0000001");
	});

	it("↑↓ 使用当前草稿作为基数，停在边界并保持 spinbutton 范围", () => {
		render(<NumberInput aria-label="数量" defaultValue={5} min={1} max={10} controls="none" />);
		fireEvent.change(field(), { target: { value: "8" } });
		fireEvent.keyDown(field(), { key: "ArrowDown" });
		expect(field().value).toBe("7");
		fireEvent.keyDown(field(), { key: "ArrowUp", shiftKey: true });
		fireEvent.keyDown(field(), { key: "ArrowUp" });
		expect(field().value).toBe("10");
		expect(field().getAttribute("aria-valuenow")).toBe("10");
		expect(field().getAttribute("aria-valuemin")).toBe("1");
		expect(field().getAttribute("aria-valuemax")).toBe("10");
	});

	it("清洗粘贴的千分位和单位，拒绝非法整段而不拼接部分数字", () => {
		render(<NumberInput aria-label="数量" defaultValue={3} precision={2} />);
		field().select();
		fireEvent.paste(field(), { clipboardData: { getData: () => "￥ 1,234.50 元" } });
		expect(field().value).toBe("1234.50");
		field().select();
		fireEvent.paste(field(), { clipboardData: { getData: () => "12oops34" } });
		expect(field().value).toBe("1234.50");
		fireEvent.paste(field(), { clipboardData: { getData: () => "1.2.3 kg" } });
		expect(field().value).toBe("1234.50");
	});

	it("宿主取消 keyboard 或 paste 后不执行内部修改，滚轮始终不改数", () => {
		render(
			<NumberInput
				aria-label="数量"
				defaultValue={3}
				onKeyDown={(e) => e.preventDefault()}
				onPaste={(e) => e.preventDefault()}
			/>,
		);
		fireEvent.keyDown(field(), { key: "ArrowUp" });
		fireEvent.paste(field(), { clipboardData: { getData: () => "42" } });
		fireEvent.wheel(field(), { deltaY: -100 });
		expect(field().value).toBe("3");
	});
});

describe("NumberInput 原生表单与受控", () => {
	it("真正的 ref/name/form 参与 FormData，步进派发真实 input，reset 恢复 defaultValue", async () => {
		const ref = createRef<HTMLInputElement>();
		const nativeInput = vi.fn();
		render(
			<>
				<form id="numbers" aria-label="表单" />
				<NumberInput
					ref={ref}
					aria-label="数量"
					name="count"
					form="numbers"
					defaultValue={2}
				/>
			</>,
		);
		const form = screen.getByRole<HTMLFormElement>("form", { name: "表单" });
		ref.current?.addEventListener("input", nativeInput);
		expect(ref.current).toBe(field());
		fireEvent.click(screen.getByRole("button", { name: "增加" }));
		expect(new FormData(form).get("count")).toBe("3");
		expect(nativeInput).toHaveBeenCalledOnce();
		await act(async () => form.reset());
		expect(field().value).toBe("2");
		fireEvent.change(field(), { target: { value: "bad" } });
		fireEvent.blur(field());
		expect(field().value).toBe("2");
	});

	it("取消 reset 保留草稿与上次提交值", async () => {
		render(
			<form aria-label="表单" onReset={(e) => e.preventDefault()}>
				<NumberInput aria-label="数量" defaultValue={2} />
			</form>,
		);
		fireEvent.keyDown(field(), { key: "ArrowUp" });
		fireEvent.change(field(), { target: { value: "-" } });
		await act(async () => screen.getByRole<HTMLFormElement>("form", { name: "表单" }).reset());
		expect(field().value).toBe("-");
		fireEvent.keyDown(field(), { key: "Escape" });
		expect(field().value).toBe("3");
	});

	it("受控的草稿回传与外部 value 切换均生效，Esc 恢复外部提交值", () => {
		function Controlled() {
			const [value, setValue] = useState<string | number>(2);
			return (
				<>
					<NumberInput
						aria-label="数量"
						value={value}
						onChange={(e) => setValue(e.currentTarget.value)}
					/>
					<button type="button" onClick={() => setValue(20)}>
						外部更新
					</button>
				</>
			);
		}
		render(<Controlled />);
		fireEvent.change(field(), { target: { value: "-" } });
		expect(field().value).toBe("-");
		fireEvent.keyDown(field(), { key: "Escape" });
		expect(field().value).toBe("2");
		fireEvent.click(screen.getByRole("button", { name: "外部更新" }));
		fireEvent.change(field(), { target: { value: "bad" } });
		fireEvent.blur(field());
		expect(field().value).toBe("20");
	});

	it("受控父层拒绝更改时不会偷偷持有新的可见数值", () => {
		const changed = vi.fn();
		render(
			<NumberInput
				aria-label="数量"
				value={2}
				onChange={(e) => changed(e.currentTarget.value)}
			/>,
		);
		fireEvent.keyDown(field(), { key: "ArrowUp" });
		expect(changed).toHaveBeenCalledExactlyOnceWith("3");
		expect(field().value).toBe("2");
	});

	it.each(["disabled", "readOnly"] as const)("%s 禁止步进、键盘和粘贴修改", (state) => {
		render(<NumberInput aria-label="数量" defaultValue={5} {...{ [state]: true }} />);
		fireEvent.keyDown(field(), { key: "ArrowUp" });
		fireEvent.click(screen.getByRole("button", { name: "增加" }));
		fireEvent.paste(field(), { clipboardData: { getData: () => "42" } });
		expect(field().value).toBe("5");
		expect(screen.getByRole<HTMLButtonElement>("button", { name: "增加" }).disabled).toBe(true);
	});
});

describe("NumberInput 长按", () => {
	it("立即一步，420ms 后每80ms连发，不把随后的指针 click 再算一次", () => {
		vi.useFakeTimers();
		render(<NumberInput aria-label="数量" defaultValue={0} />);
		const increase = screen.getByRole("button", { name: "增加" });
		fireEvent.pointerDown(increase, { button: 0, pointerId: 1 });
		expect(field().value).toBe("1");
		act(() => vi.advanceTimersByTime(499));
		expect(field().value).toBe("1");
		act(() => vi.advanceTimersByTime(1));
		expect(field().value).toBe("2");
		act(() => vi.advanceTimersByTime(160));
		expect(field().value).toBe("4");
		fireEvent.pointerUp(window);
		fireEvent.click(increase, { detail: 1 });
		act(() => vi.advanceTimersByTime(1000));
		expect(field().value).toBe("4");
	});

	it.each(["pointerLeave", "pointerCancel", "blur"] as const)("%s 停止长按", (stop) => {
		vi.useFakeTimers();
		render(<NumberInput aria-label="数量" defaultValue={0} />);
		const increase = screen.getByRole("button", { name: "增加" });
		fireEvent.pointerDown(increase, { button: 0, pointerId: 1 });
		if (stop === "blur") fireEvent.blur(window);
		else fireEvent[stop](increase);
		act(() => vi.advanceTimersByTime(1000));
		expect(field().value).toBe("1");
	});

	it("卸载后长按不继续提交数值", () => {
		vi.useFakeTimers();
		const commit = vi.fn();
		const { unmount } = render(
			<NumberInput aria-label="数量" defaultValue={0} onValueCommit={commit} />,
		);
		fireEvent.pointerDown(screen.getByRole("button", { name: "增加" }), { button: 0 });
		expect(commit.mock.calls).toEqual([[1]]);
		unmount();
		act(() => vi.advanceTimersByTime(2000));
		expect(commit.mock.calls).toEqual([[1]]);
	});
});
