import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../index";

function slots() {
	return screen.getAllByRole("textbox") as HTMLInputElement[];
}

function ControlledOTP() {
	const [value, setValue] = useState("");
	return <InputOTP value={value} onChange={setValue} />;
}

describe("InputOTP keyboard and input", () => {
	it("六格独立命名，数字跳格，填满只发出真实完成值", () => {
		const complete = vi.fn();
		const change = vi.fn();
		render(<InputOTP onChange={change} onComplete={complete} />);
		expect(screen.getByRole("group", { name: "6 位验证码" })).toBeTruthy();
		for (const [index, digit] of [..."738105"].entries()) {
			const input = screen.getByRole("textbox", { name: `第 ${index + 1} 位` });
			fireEvent.change(input, { target: { value: digit } });
			expect(document.activeElement).toBe(slots()[Math.min(index + 1, 5)]);
			if (index < 5) expect(complete).not.toHaveBeenCalled();
		}
		expect(slots().map((input) => input.value)).toEqual([..."738105"]);
		expect(change).toHaveBeenLastCalledWith("738105");
		expect(complete.mock.calls).toEqual([["738105"]]);
		fireEvent.change(slots()[5], { target: { value: "5" } });
		expect(complete).toHaveBeenCalledOnce();
	});

	it("退格清空当前位并回前位，空格退格同时清掉前一位，不挤走后续数字", () => {
		render(<InputOTP defaultValue="123456" />);
		const inputs = slots();
		inputs[2]?.focus();
		fireEvent.keyDown(inputs[2] as HTMLInputElement, { key: "Backspace" });
		expect(inputs.map((input) => input.value)).toEqual(["1", "2", "", "4", "5", "6"]);
		expect(document.activeElement).toBe(inputs[1]);
		inputs[2]?.focus();
		fireEvent.keyDown(inputs[2] as HTMLInputElement, { key: "Backspace" });
		expect(inputs.map((input) => input.value)).toEqual(["1", "", "", "4", "5", "6"]);
		expect(document.activeElement).toBe(inputs[1]);
	});

	it("左右移动不改变值，在两端停住，Delete 不移动焦点", () => {
		render(<InputOTP defaultValue="246810" />);
		const inputs = slots();
		inputs[0]?.focus();
		fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "ArrowLeft" });
		expect(document.activeElement).toBe(inputs[0]);
		fireEvent.keyDown(inputs[0] as HTMLInputElement, { key: "ArrowRight" });
		expect(document.activeElement).toBe(inputs[1]);
		fireEvent.keyDown(inputs[1] as HTMLInputElement, { key: "Delete" });
		expect(inputs[1]?.value).toBe("");
		expect(inputs[2]?.value).toBe("6");
		expect(document.activeElement).toBe(inputs[1]);
		inputs[5]?.focus();
		fireEvent.keyDown(inputs[5] as HTMLInputElement, { key: "ArrowRight" });
		expect(document.activeElement).toBe(inputs[5]);
	});

	it("任意格粘贴整串都从首格拆分，过滤分隔符并仅完成一次", () => {
		const complete = vi.fn();
		render(<InputOTP defaultValue="11" onComplete={complete} />);
		fireEvent.paste(slots()[4] as HTMLInputElement, {
			clipboardData: { getData: () => "验证码 987-654" },
		});
		expect(slots().map((input) => input.value)).toEqual([..."987654"]);
		expect(document.activeElement).toBe(slots()[5]);
		expect(complete.mock.calls).toEqual([["987654"]]);
	});

	it("短信自动填第一格的完整 change 按整串拆分，短粘贴从当前位起写", () => {
		render(<InputOTP />);
		fireEvent.change(slots()[0] as HTMLInputElement, { target: { value: "819273" } });
		expect(slots().map((input) => input.value)).toEqual([..."819273"]);
		fireEvent.paste(slots()[3] as HTMLInputElement, {
			clipboardData: { getData: () => "45" },
		});
		expect(slots().map((input) => input.value)).toEqual([..."819453"]);
		expect(document.activeElement).toBe(slots()[5]);
	});

	it("组合 API 中的原生 ref 可聚焦，取消 root 键盘与 slot 粘贴不改变值", () => {
		const first = createRef<HTMLInputElement>();
		const fourth = createRef<HTMLInputElement>();
		const change = vi.fn();
		render(
			<InputOTP ref={first} onChange={change} onKeyDown={(event) => event.preventDefault()}>
				<InputOTPGroup>
					{Array.from({ length: 6 }, (_, index) => (
						<InputOTPSlot
							key={index}
							index={index}
							ref={index === 3 ? fourth : undefined}
							onPaste={(event) => event.preventDefault()}
						/>
					))}
				</InputOTPGroup>
			</InputOTP>,
		);
		expect(first.current).toBe(slots()[0]);
		expect(fourth.current).toBe(slots()[3]);
		first.current?.focus();
		fireEvent.keyDown(first.current as HTMLInputElement, { key: "ArrowRight" });
		expect(document.activeElement).toBe(first.current);
		fireEvent.paste(fourth.current as HTMLInputElement, {
			clipboardData: { getData: () => "123456" },
		});
		expect(slots().every((input) => input.value === "")).toBe(true);
		expect(change).not.toHaveBeenCalled();
	});

	it("受控值拒绝输入时不提前接受，外部同步更新不会触发完成", () => {
		const complete = vi.fn();
		const change = vi.fn();
		const { rerender } = render(
			<InputOTP value="12" onChange={change} onComplete={complete} />,
		);
		fireEvent.change(slots()[2] as HTMLInputElement, { target: { value: "3" } });
		expect(change).toHaveBeenCalledWith("123");
		expect(slots().map((input) => input.value)).toEqual(["1", "2", "", "", "", ""]);
		rerender(<InputOTP value="654321" onChange={change} onComplete={complete} />);
		expect(slots().map((input) => input.value)).toEqual([..."654321"]);
		expect(complete).not.toHaveBeenCalled();
	});

	it("已有数字的格子输入单个字符仍只替换本位，非数字不会清掉旧值", () => {
		render(<InputOTP defaultValue="123456" />);
		fireEvent.input(slots()[2] as HTMLInputElement, {
			target: { value: "38" },
			data: "8",
			inputType: "insertText",
		});
		expect(slots().map((input) => input.value)).toEqual([..."128456"]);
		fireEvent.input(slots()[2] as HTMLInputElement, {
			target: { value: "8a" },
			data: "a",
			inputType: "insertText",
		});
		expect(slots().map((input) => input.value)).toEqual([..."128456"]);
	});

	it("受控父层回写空洞序列时保留每格位置，补齐才算完成", () => {
		render(<ControlledOTP />);
		fireEvent.change(slots()[0] as HTMLInputElement, { target: { value: "123456" } });
		fireEvent.keyDown(slots()[2] as HTMLInputElement, { key: "Backspace" });
		expect(slots().map((input) => input.value)).toEqual(["1", "2", "", "4", "5", "6"]);
		fireEvent.change(slots()[2] as HTMLInputElement, { target: { value: "8" } });
		expect(slots().map((input) => input.value)).toEqual([..."128456"]);
	});

	it("受控回声与重复粘贴不会重复完成，删除后重新补齐同一码可再次完成", () => {
		const complete = vi.fn();
		function Echo() {
			const [value, setValue] = useState("");
			return <InputOTP value={value} onChange={setValue} onComplete={complete} />;
		}
		render(<Echo />);
		fireEvent.paste(slots()[0] as HTMLInputElement, {
			clipboardData: { getData: () => "482916" },
		});
		fireEvent.paste(slots()[3] as HTMLInputElement, {
			clipboardData: { getData: () => "482916" },
		});
		expect(complete.mock.calls).toEqual([["482916"]]);
		fireEvent.keyDown(slots()[2] as HTMLInputElement, { key: "Delete" });
		expect(complete).toHaveBeenCalledOnce();
		fireEvent.change(slots()[2] as HTMLInputElement, { target: { value: "2" } });
		expect(complete.mock.calls).toEqual([["482916"], ["482916"]]);
	});

	it("外部替换受控值后不复用旧空位，拒绝的编辑也不留下旧空位", () => {
		const change = vi.fn();
		const { rerender } = render(<InputOTP value="123456" onChange={change} />);
		fireEvent.keyDown(slots()[2] as HTMLInputElement, { key: "Delete" });
		expect(change).toHaveBeenLastCalledWith("12456");
		rerender(<InputOTP value="12456" onChange={change} />);
		expect(slots().map((input) => input.value)).toEqual(["1", "2", "4", "5", "6", ""]);
		rerender(<InputOTP value="987654" onChange={change} />);
		rerender(<InputOTP value="12456" onChange={change} />);
		expect(slots().map((input) => input.value)).toEqual(["1", "2", "4", "5", "6", ""]);
	});

	it("单格取消原生 change 时既不跳格也不完成，首格短信填入会覆盖旧码", () => {
		const complete = vi.fn();
		const { rerender } = render(
			<InputOTP defaultValue="123456" onComplete={complete}>
				<InputOTPGroup>
					{Array.from({ length: 6 }, (_, index) => (
						<InputOTPSlot
							key={index}
							index={index}
							onChange={(event) => event.preventDefault()}
						/>
					))}
				</InputOTPGroup>
			</InputOTP>,
		);
		slots()[0]?.focus();
		fireEvent.change(slots()[0] as HTMLInputElement, { target: { value: "9" } });
		expect(slots().map((input) => input.value)).toEqual([..."123456"]);
		expect(document.activeElement).toBe(slots()[0]);
		expect(complete).not.toHaveBeenCalled();
		rerender(<InputOTP defaultValue="123456" onComplete={complete} />);
		fireEvent.input(slots()[0] as HTMLInputElement, {
			target: { value: "819273" },
			data: "819273",
			inputType: "insertReplacementText",
		});
		expect(slots().map((input) => input.value)).toEqual([..."819273"]);
		expect(complete.mock.calls).toEqual([["819273"]]);
	});
});
