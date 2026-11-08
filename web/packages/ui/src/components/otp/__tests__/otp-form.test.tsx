import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Field } from "../../field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../index";

function inputs() {
	return screen.getAllByRole("textbox") as HTMLInputElement[];
}

describe("InputOTP forms and accessibility", () => {
	it("原生 FormData 只序列化一份完整值，reset 回到初值且通知调用方", async () => {
		const change = vi.fn();
		const { container } = render(
			<form>
				<InputOTP name="code" defaultValue="12" onChange={change} required />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(form.checkValidity()).toBe(false);
		fireEvent.change(inputs()[0] as HTMLInputElement, { target: { value: "765432" } });
		expect(form.checkValidity()).toBe(true);
		expect(new FormData(form).getAll("code")).toEqual(["765432"]);
		await act(async () => form.reset());
		expect(inputs().map((input) => input.value)).toEqual(["1", "2", "", "", "", ""]);
		expect(new FormData(form).get("code")).toBe("12");
		expect(change).toHaveBeenLastCalledWith("12");
	});

	it("reset 可取消；外部 form 归属同样参与序列化和复位", async () => {
		const change = vi.fn();
		const { container, rerender } = render(
			<>
				<form id="external-otp" onReset={(event) => event.preventDefault()} />
				<InputOTP form="external-otp" name="code" defaultValue="3" onChange={change} />
			</>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		fireEvent.change(inputs()[1] as HTMLInputElement, { target: { value: "4" } });
		await act(async () => form.reset());
		expect(new FormData(form).get("code")).toBe("34");
		expect(change.mock.calls).toEqual([["34"]]);
		rerender(
			<>
				<form id="external-otp" />
				<InputOTP form="external-otp" name="code" defaultValue="3" onChange={change} />
			</>,
		);
		await act(async () => form.reset());
		expect(new FormData(form).get("code")).toBe("3");
	});

	it("受控 reset 向父层请求初值，父层拒绝时保留当前显示和提交值", async () => {
		const change = vi.fn();
		const { container, rerender } = render(
			<form>
				<InputOTP name="code" value="123456" onChange={change} />
			</form>,
		);
		rerender(
			<form>
				<InputOTP name="code" value="654321" onChange={change} />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		await act(async () => form.reset());
		expect(change).toHaveBeenLastCalledWith("123456");
		expect(inputs().map((input) => input.value)).toEqual([..."654321"]);
		expect(new FormData(form).get("code")).toBe("654321");
	});

	it("readOnly 可聚焦和复制但不改值；disabled 不提交，也不触发完成", () => {
		const complete = vi.fn();
		const { container, rerender } = render(
			<form>
				<InputOTP name="code" defaultValue="135790" readOnly onComplete={complete} />
			</form>,
		);
		inputs()[0]?.focus();
		expect(document.activeElement).toBe(inputs()[0]);
		fireEvent.keyDown(inputs()[0] as HTMLInputElement, { key: "Backspace" });
		fireEvent.change(inputs()[0] as HTMLInputElement, { target: { value: "9" } });
		fireEvent.keyDown(inputs()[0] as HTMLInputElement, { key: "ArrowRight" });
		expect(document.activeElement).toBe(inputs()[1]);
		fireEvent.paste(inputs()[0] as HTMLInputElement, {
			clipboardData: { getData: () => "999999" },
		});
		expect(inputs().map((input) => input.value)).toEqual([..."135790"]);
		expect(new FormData(container.querySelector("form") as HTMLFormElement).get("code")).toBe(
			"135790",
		);
		rerender(
			<form>
				<InputOTP name="code" defaultValue="135790" disabled onComplete={complete} />
			</form>,
		);
		expect(inputs().every((input) => input.disabled)).toBe(true);
		expect(new FormData(container.querySelector("form") as HTMLFormElement).has("code")).toBe(
			false,
		);
		expect(complete).not.toHaveBeenCalled();
	});

	it("Field 标签命名整组，各位仍有自己的名称和外部说明", () => {
		const ref = createRef<HTMLInputElement>();
		render(
			<Field label="邮箱验证码" hint="请输入邮件里的六位数字">
				<InputOTP ref={ref} />
			</Field>,
		);
		expect(screen.getByRole("group", { name: "邮箱验证码" })).toBeTruthy();
		const hint = screen.getByText("请输入邮件里的六位数字").parentElement;
		for (const [index, input] of inputs().entries()) {
			expect(screen.getByRole("textbox", { name: `第 ${index + 1} 位` })).toBe(input);
			expect(input.getAttribute("aria-describedby")).toBe(hint?.id);
			expect(input.inputMode).toBe("numeric");
			expect(input.autocomplete).toBe("one-time-code");
		}
		fireEvent.click(screen.getByText("邮箱验证码"));
		expect(ref.current?.id).toBe(screen.getByText("邮箱验证码").getAttribute("for"));
	});

	it("受控值随原生 reset 由父层确认后同步更新", async () => {
		function Form() {
			const [value, setValue] = useState("23");
			return (
				<form>
					<InputOTP name="code" value={value} onChange={setValue} />
				</form>
			);
		}
		const { container } = render(<Form />);
		fireEvent.change(inputs()[0] as HTMLInputElement, { target: { value: "817263" } });
		const form = container.querySelector("form") as HTMLFormElement;
		await act(async () => form.reset());
		expect(new FormData(form).get("code")).toBe("23");
		expect(inputs().map((input) => input.value)).toEqual(["2", "3", "", "", "", ""]);
	});

	it("SSR 到水合保留各位唯一标识和组的说明接线", async () => {
		const element = (
			<Field label="六位邮件验证码" hint="十分钟内有效">
				<InputOTP defaultValue="842" />
			</Field>
		);
		const container = document.createElement("div");
		container.innerHTML = renderToString(element);
		document.body.append(container);
		const original = [...container.querySelectorAll("input")].map((input) => input.id);
		let root: Root | undefined;
		await act(async () => {
			root = hydrateRoot(container, element);
		});
		try {
			const hydrated = [...container.querySelectorAll("input")];
			expect(hydrated.map((input) => input.id)).toEqual(original);
			expect(new Set(original).size).toBe(6);
			expect(hydrated.map((input) => input.value)).toEqual(["8", "4", "2", "", "", ""]);
		} finally {
			await act(async () => root?.unmount());
			container.remove();
		}
	});

	it("显式组名不会覆盖各格名称，首格id同时接到ref和Field标签", () => {
		const first = createRef<HTMLInputElement>();
		render(
			<Field label="邮箱验证码">
				<InputOTP ref={first} id="email-code" aria-label="登录验证码" />
			</Field>,
		);
		expect(screen.getByRole("group", { name: "登录验证码" })).toBeTruthy();
		expect(first.current).toBe(screen.getByRole("textbox", { name: "第 1 位" }));
		expect(first.current?.id).toBe("email-code");
		expect(screen.getByText("邮箱验证码").getAttribute("for")).toBe("email-code");
		expect(inputs().map((input) => input.id)).toEqual([
			"email-code",
			"email-code-2",
			"email-code-3",
			"email-code-4",
			"email-code-5",
			"email-code-6",
		]);
	});

	it("自定义组合的callback ref清理继续交给真实首格与单格", () => {
		const rootCleanup = vi.fn();
		const slotCleanup = vi.fn();
		const rootRef = vi.fn((_input: HTMLInputElement | null) => rootCleanup);
		const slotRef = vi.fn((_input: HTMLInputElement | null) => slotCleanup);
		const { unmount } = render(
			<InputOTP ref={rootRef}>
				<InputOTPGroup>
					{Array.from({ length: 6 }, (_, index) => (
						<InputOTPSlot
							key={index}
							index={index}
							ref={index === 2 ? slotRef : undefined}
						/>
					))}
				</InputOTPGroup>
			</InputOTP>,
		);
		expect(rootRef).toHaveBeenLastCalledWith(inputs()[0]);
		expect(slotRef).toHaveBeenLastCalledWith(inputs()[2]);
		unmount();
		expect(rootCleanup).toHaveBeenCalledOnce();
		expect(slotCleanup).toHaveBeenCalledOnce();
	});

	it.each([
		"detached",
		"shadow",
	] as const)("%s DOM中的表单也能取消reset并恢复初值", async (scope) => {
		const host = document.createElement("div");
		const container = document.createElement("div");
		if (scope === "shadow") {
			document.body.append(host);
			host.attachShadow({ mode: "open" }).append(container);
		} else host.append(container);
		const change = vi.fn();
		const element = (cancel: boolean) => (
			<form onReset={cancel ? (event) => event.preventDefault() : undefined}>
				<InputOTP name="code" defaultValue="23" onChange={change} />
			</form>
		);
		const { rerender, unmount } = render(element(true), { container });
		try {
			const form = container.querySelector("form") as HTMLFormElement;
			const first = container.querySelector("input") as HTMLInputElement;
			fireEvent.change(first, { target: { value: "765432" } });
			await act(async () => form.reset());
			expect(new FormData(form).getAll("code")).toEqual(["765432"]);
			rerender(element(false));
			await act(async () => form.reset());
			expect(new FormData(form).getAll("code")).toEqual(["23"]);
			expect(
				[...container.querySelectorAll<HTMLInputElement>('input[type="text"]')].map(
					(input) => input.value,
				),
			).toEqual(["2", "3", "", "", "", ""]);
		} finally {
			unmount();
			host.remove();
		}
	});
});
