import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field } from "../../field";
import { InputOTP } from "../index";

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("InputOTP validation state", () => {
	it("错误边沿等500ms涟漪后清空回首格，外部aria-live保留错误说明", () => {
		vi.useFakeTimers();
		const change = vi.fn();
		const { rerender } = render(<InputOTP defaultValue="246813" onChange={change} />);
		(screen.getByRole("textbox", { name: "第 6 位" }) as HTMLInputElement).focus();
		rerender(
			<Field label="验证码" error="验证码不对，请重新输入">
				<InputOTP defaultValue="246813" onChange={change} invalid />
			</Field>,
		);
		const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
		expect(inputs.every((input) => input.getAttribute("aria-invalid") === "true")).toBe(true);
		expect(inputs.map((input) => input.value).join("")).toBe("246813");
		act(() => vi.advanceTimersByTime(499));
		expect(change).not.toHaveBeenCalled();
		act(() => vi.advanceTimersByTime(1));
		expect(inputs.every((input) => input.value === "")).toBe(true);
		expect(document.activeElement).toBe(inputs[0]);
		expect(change).toHaveBeenLastCalledWith("");
		expect(
			screen
				.getByText("验证码不对，请重新输入")
				.closest("[aria-live]")
				?.getAttribute("aria-live"),
		).toBe("polite");
		fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: "7" } });
		act(() => vi.advanceTimersByTime(1000));
		expect(inputs[0]?.value).toBe("7");
	});

	it("减弱动态时不等待动画，错误立即请求清空，状态本身仍归父层", () => {
		vi.useFakeTimers();
		vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
			matches: true,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
		const change = vi.fn();
		const { rerender } = render(<InputOTP value="123456" onChange={change} invalid />);
		expect(change).toHaveBeenCalledWith("");
		expect((screen.getByRole("textbox", { name: "第 1 位" }) as HTMLInputElement).value).toBe(
			"1",
		);
		rerender(<InputOTP value="" onChange={change} invalid />);
		expect(
			screen
				.getAllByRole("textbox")
				.every((input) => (input as HTMLInputElement).value === ""),
		).toBe(true);
	});

	it("撤销错误和卸载会取消延迟清空，成功状态不改值也不自行宣告结果", () => {
		vi.useFakeTimers();
		const change = vi.fn();
		const { rerender, unmount } = render(
			<InputOTP defaultValue="369258" invalid onChange={change} />,
		);
		act(() => vi.advanceTimersByTime(250));
		rerender(<InputOTP defaultValue="369258" valid onChange={change} />);
		act(() => vi.advanceTimersByTime(500));
		expect(
			screen
				.getAllByRole("textbox")
				.map((input) => (input as HTMLInputElement).value)
				.join(""),
		).toBe("369258");
		expect(screen.queryByRole("status")).toBeNull();
		expect(change).not.toHaveBeenCalled();
		rerender(<InputOTP defaultValue="369258" invalid onChange={change} />);
		unmount();
		act(() => vi.advanceTimersByTime(500));
		expect(change).not.toHaveBeenCalled();
	});

	it("同一错误保持期间切换只读或禁用只取消清空，不重新触发错误边沿", () => {
		vi.useFakeTimers();
		const change = vi.fn();
		const { rerender } = render(<InputOTP defaultValue="123456" invalid onChange={change} />);
		act(() => vi.advanceTimersByTime(250));
		rerender(<InputOTP defaultValue="123456" invalid readOnly onChange={change} />);
		act(() => vi.advanceTimersByTime(500));
		rerender(<InputOTP defaultValue="123456" invalid onChange={change} />);
		act(() => vi.advanceTimersByTime(1000));
		expect(change).not.toHaveBeenCalled();
		expect(
			screen.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value),
		).toEqual([..."123456"]);
		rerender(<InputOTP defaultValue="123456" invalid disabled onChange={change} />);
		rerender(<InputOTP defaultValue="123456" invalid onChange={change} />);
		act(() => vi.advanceTimersByTime(1000));
		expect(change).not.toHaveBeenCalled();
		rerender(<InputOTP defaultValue="123456" onChange={change} />);
		rerender(<InputOTP defaultValue="123456" invalid onChange={change} />);
		act(() => vi.advanceTimersByTime(500));
		expect(change.mock.calls).toEqual([[""]]);
	});

	it("错误涟漪期间禁止编辑，原生 reset 会取消后续清空并恢复初值", async () => {
		vi.useFakeTimers();
		const change = vi.fn();
		const complete = vi.fn();
		const { container, rerender } = render(
			<form>
				<InputOTP defaultValue="12" onChange={change} onComplete={complete} />
			</form>,
		);
		fireEvent.change(screen.getAllByRole("textbox")[0] as HTMLInputElement, {
			target: { value: "654321" },
		});
		rerender(
			<form>
				<InputOTP defaultValue="12" invalid onChange={change} onComplete={complete} />
			</form>,
		);
		fireEvent.change(screen.getAllByRole("textbox")[0] as HTMLInputElement, {
			target: { value: "9" },
		});
		expect(change.mock.calls).toEqual([["654321"]]);
		const form = container.querySelector("form") as HTMLFormElement;
		await act(async () => form.reset());
		act(() => vi.advanceTimersByTime(500));
		expect(
			screen.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value),
		).toEqual(["1", "2", "", "", "", ""]);
		expect(change.mock.calls).toEqual([["654321"], ["12"]]);
		expect(complete.mock.calls).toEqual([["654321"]]);
	});
});

describe("InputOTP 受控完成与锁定", () => {
	const slots = () => screen.getAllByRole("textbox") as HTMLInputElement[];

	it("父层拒绝第六位或整串粘贴时不完成，随后接受同一输入只完成一次", () => {
		const complete = vi.fn();
		const { rerender } = render(
			<InputOTP value="12345" onChange={() => {}} onComplete={complete} />,
		);
		fireEvent.change(slots()[5] as HTMLInputElement, { target: { value: "6" } });
		fireEvent.paste(slots()[0] as HTMLInputElement, {
			clipboardData: { getData: () => "654321" },
		});
		expect(complete).not.toHaveBeenCalled();
		expect(
			slots()
				.map((input) => input.value)
				.join(""),
		).toBe("12345");
		function Accepting() {
			const [value, setValue] = useState("12345");
			return <InputOTP value={value} onChange={setValue} onComplete={complete} />;
		}
		rerender(<Accepting />);
		fireEvent.change(slots()[5] as HTMLInputElement, { target: { value: "6" } });
		expect(complete.mock.calls).toEqual([["123456"]]);
	});

	it("被拒绝后外部补满不会补发旧事件，外部更新本身也不算用户完成", () => {
		const complete = vi.fn();
		const { rerender } = render(
			<InputOTP value="12345" onChange={() => {}} onComplete={complete} />,
		);
		fireEvent.change(slots()[5] as HTMLInputElement, { target: { value: "6" } });
		rerender(<InputOTP value="123456" onChange={() => {}} onComplete={complete} />);
		expect(complete).not.toHaveBeenCalled();
	});

	it("请求仍禁用时到达的错误，在解锁后仍播放一次涟漪并清空", () => {
		vi.useFakeTimers();
		const change = vi.fn();
		const { rerender } = render(<InputOTP defaultValue="123456" disabled onChange={change} />);
		rerender(<InputOTP defaultValue="123456" disabled invalid onChange={change} />);
		act(() => vi.advanceTimersByTime(1000));
		expect(change).not.toHaveBeenCalled();
		rerender(<InputOTP defaultValue="123456" invalid onChange={change} />);
		expect(slots()[0]?.parentElement?.getAttribute("data-readonly")).toBe("true");
		act(() => vi.advanceTimersByTime(500));
		expect(change.mock.calls).toEqual([[""]]);
	});
});
