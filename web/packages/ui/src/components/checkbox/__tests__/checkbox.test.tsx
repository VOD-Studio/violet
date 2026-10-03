import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useId, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Label } from "../../label";
import { Checkbox } from "../checkbox";
import { checkboxVariants } from "../styles";

describe("Checkbox", () => {
	it("点击只切换状态，宽对象的 submit type 不能覆盖固定 button 类型", () => {
		const submit = vi.fn((event) => event.preventDefault());
		const externalProps: Record<string, unknown> = { type: "submit" };
		render(
			<form onSubmit={submit}>
				<Checkbox aria-label="普通选项" />
				<Checkbox {...externalProps} aria-label="外部属性选项" />
			</form>,
		);
		for (const name of ["普通选项", "外部属性选项"]) {
			const checkbox = screen.getByRole("checkbox", { name }) as HTMLButtonElement;
			expect(checkbox.type).toBe("button");
			fireEvent.click(checkbox);
			expect(checkbox.getAttribute("aria-checked")).toBe("true");
		}
		expect(submit).not.toHaveBeenCalled();
	});

	it("关联 Label 命名与点击保留二元状态切换", () => {
		render(
			<>
				<Checkbox id="terms" />
				<Label htmlFor="terms">接受服务条款</Label>
			</>,
		);
		const checkbox = screen.getByRole("checkbox", { name: "接受服务条款" });
		expect(checkbox.getAttribute("aria-checked")).toBe("false");
		fireEvent.click(screen.getByText("接受服务条款"));
		expect(checkbox.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(checkbox);
		expect(checkbox.getAttribute("aria-checked")).toBe("false");
	});

	it("受控值由宿主确认，半选点击请求全选", () => {
		const change = vi.fn();
		const { rerender } = render(
			<Checkbox checked="indeterminate" onCheckedChange={change} aria-label="全选" />,
		);
		const checkbox = screen.getByRole("checkbox", { name: "全选" });
		expect(checkbox.getAttribute("aria-checked")).toBe("mixed");
		fireEvent.click(checkbox);
		expect(change).toHaveBeenCalledWith(true);
		expect(checkbox.getAttribute("aria-checked")).toBe("mixed");

		rerender(<Checkbox checked onCheckedChange={change} aria-label="全选" />);
		expect(checkbox.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(checkbox);
		expect(change).toHaveBeenLastCalledWith(false);
	});

	it("受控回调更新勾选状态", () => {
		function Subscription() {
			const [checked, setChecked] = useState(false);
			return (
				<Checkbox
					checked={checked}
					onCheckedChange={(next) => setChecked(next === true)}
					aria-label="订阅"
				/>
			);
		}
		render(<Subscription />);
		const checkbox = screen.getByRole("checkbox", { name: "订阅" });
		fireEvent.click(checkbox);
		expect(checkbox.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(checkbox);
		expect(checkbox.getAttribute("aria-checked")).toBe("false");
	});

	it("非受控 defaultChecked 与 defaultChecked 半选都可交互", () => {
		const change = vi.fn();
		render(
			<>
				<Checkbox defaultChecked aria-label="邮件" />
				<Checkbox
					defaultChecked="indeterminate"
					onCheckedChange={change}
					aria-label="通知通道"
				/>
			</>,
		);
		const checked = screen.getByRole("checkbox", { name: "邮件" });
		fireEvent.click(checked);
		expect(checked.getAttribute("aria-checked")).toBe("false");

		const mixed = screen.getByRole("checkbox", { name: "通知通道" });
		expect(mixed.getAttribute("aria-checked")).toBe("mixed");
		fireEvent.click(mixed);
		expect(mixed.getAttribute("aria-checked")).toBe("true");
		expect(change).toHaveBeenCalledWith(true);
	});

	it.each([
		{ initial: false, count: 2, expected: false, changes: [true, false] },
		{ initial: true, count: 2, expected: true, changes: [false, true] },
		{ initial: "indeterminate", count: 2, expected: false, changes: [true, false] },
		{ initial: false, count: 3, expected: true, changes: [true, false, true] },
		{ initial: true, count: 3, expected: false, changes: [false, true, false] },
		{ initial: "indeterminate", count: 3, expected: true, changes: [true, false, true] },
	] as const)("非受控初值 $initial 在同一批次激活 $count 次时按当前模型切换", ({
		initial,
		count,
		expected,
		changes,
	}) => {
		const change = vi.fn();
		const { container } = render(
			<form>
				<Checkbox
					defaultChecked={initial}
					onCheckedChange={change}
					name="option"
					aria-label="批次选择"
				/>
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		const control = screen.getByRole("checkbox", { name: "批次选择" });
		act(() => {
			for (let index = 0; index < count; index++) control.click();
		});
		expect(control.getAttribute("aria-checked")).toBe(String(expected));
		expect(new FormData(form).has("option")).toBe(expected);
		expect(change.mock.calls.map(([value]) => value)).toEqual(changes);
	});

	it("同批次受控激活仍请求宿主状态，不提前接受请求值", () => {
		const change = vi.fn();
		render(<Checkbox checked={false} onCheckedChange={change} aria-label="受控批次" />);
		const control = screen.getByRole("checkbox", { name: "受控批次" });
		act(() => {
			control.click();
			control.click();
		});
		expect(control.getAttribute("aria-checked")).toBe("false");
		expect(change.mock.calls).toEqual([[true], [true]]);
	});

	it("外部 onClick preventDefault 取消内部切换", () => {
		const click = vi.fn((event) => event.preventDefault());
		const change = vi.fn();
		render(<Checkbox onClick={click} onCheckedChange={change} aria-label="需要确认的选项" />);
		const checkbox = screen.getByRole("checkbox", { name: "需要确认的选项" });
		fireEvent.click(checkbox);
		expect(click).toHaveBeenCalledOnce();
		expect(change).not.toHaveBeenCalled();
		expect(checkbox.getAttribute("aria-checked")).toBe("false");
	});

	it.each([
		["shadow", false],
		["shadow", true],
		["detached", false],
		["detached", true],
	] as const)("%s 作用域内原生 reset 遵守取消=%s", async (scope, canceled) => {
		const host = document.createElement("div");
		const container = document.createElement("div");
		const root = scope === "shadow" ? host.attachShadow({ mode: "open" }) : container;
		if (scope === "shadow") {
			root.appendChild(container);
			document.body.append(host);
		}
		const change = vi.fn();
		const { getByRole, unmount } = render(
			<form
				onReset={(event) => {
					if (canceled) event.preventDefault();
				}}
			>
				<Checkbox
					defaultChecked
					name="option"
					onCheckedChange={change}
					aria-label="独立作用域"
				/>
			</form>,
			{ container, baseElement: container },
		);
		try {
			const form = container.querySelector("form") as HTMLFormElement;
			const control = getByRole("checkbox", { name: "独立作用域" }) as HTMLButtonElement;
			expect(control.getRootNode()).toBe(root);
			expect(control.form).toBe(form);
			fireEvent.click(control);
			change.mockClear();
			await act(async () => form.reset());
			expect(control.getAttribute("aria-checked")).toBe(canceled ? "false" : "true");
			expect(new FormData(form).has("option")).toBe(!canceled);
			expect(change.mock.calls).toEqual(canceled ? [] : [[true]]);
		} finally {
			unmount();
			host.remove();
			container.remove();
		}
	});

	it("独立容器后接入 document 时，受控 reset 请求不会被两层捕获重复通知", async () => {
		const container = document.createElement("div");
		const change = vi.fn();
		const preference = (checked: boolean) => (
			<form>
				<Checkbox
					checked={checked}
					onCheckedChange={change}
					name="option"
					aria-label="接入受控"
				/>
			</form>
		);
		const { getByRole, rerender, unmount } = render(preference(false), {
			container,
			baseElement: container,
		});
		try {
			rerender(preference(true));
			document.body.append(container);
			const form = container.querySelector("form") as HTMLFormElement;
			await act(async () => form.reset());
			expect(change.mock.calls).toEqual([[false]]);
			expect(getByRole("checkbox", { name: "接入受控" }).getAttribute("aria-checked")).toBe(
				"true",
			);
			expect(new FormData(form).get("option")).toBe("on");
		} finally {
			unmount();
			container.remove();
		}
	});

	it("独立容器后接入 document 时，晚挂外部 form 可恢复当前模型", async () => {
		const container = document.createElement("div");
		const externalForm = document.createElement("form");
		externalForm.id = "attached-external";
		const change = vi.fn();
		const { getByRole, unmount } = render(
			<Checkbox
				form="attached-external"
				defaultChecked
				onCheckedChange={change}
				name="option"
				aria-label="接入外部"
			/>,
			{ container, baseElement: container },
		);
		try {
			const control = getByRole("checkbox", { name: "接入外部" }) as HTMLButtonElement;
			fireEvent.click(control);
			document.body.append(container, externalForm);
			expect(control.form).toBe(externalForm);
			change.mockClear();
			await act(async () => externalForm.reset());
			expect(control.getAttribute("aria-checked")).toBe("true");
			expect(new FormData(externalForm).get("option")).toBe("on");
			expect(change.mock.calls).toEqual([[true]]);
		} finally {
			unmount();
			container.remove();
			externalForm.remove();
		}
	});

	it("Enter 保留外部 keydown 并取消按钮默认激活", () => {
		const keyDown = vi.fn();
		const change = vi.fn();
		render(<Checkbox onKeyDown={keyDown} onCheckedChange={change} aria-label="键盘选项" />);
		const checkbox = screen.getByRole("checkbox", { name: "键盘选项" });
		expect(fireEvent.keyDown(checkbox, { key: "Enter" })).toBe(false);
		expect(keyDown).toHaveBeenCalledOnce();
		expect(change).not.toHaveBeenCalled();
	});

	it("disabled 禁止点击，并透传原生禁用属性", () => {
		const change = vi.fn();
		const click = vi.fn();
		render(
			<Checkbox disabled onClick={click} onCheckedChange={change} aria-label="禁用选项" />,
		);
		const checkbox = screen.getByRole("checkbox", { name: "禁用选项" }) as HTMLButtonElement;
		expect(checkbox.disabled).toBe(true);
		expect(checkbox.hasAttribute("data-disabled")).toBe(true);
		fireEvent.click(checkbox);
		expect(click).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();
	});

	it("object ref 与 callback ref 指向可聚焦的 button 并在卸载时清理", () => {
		const objectRef = createRef<HTMLButtonElement>();
		const callbackRef = vi.fn();
		const { unmount } = render(
			<>
				<Checkbox ref={objectRef} aria-label="对象引用" />
				<Checkbox ref={callbackRef} aria-label="回调引用" />
			</>,
		);
		const checkbox = screen.getByRole("checkbox", { name: "对象引用" });
		expect(objectRef.current).toBe(checkbox);
		expect(callbackRef).toHaveBeenCalledWith(
			screen.getByRole("checkbox", { name: "回调引用" }),
		);
		objectRef.current?.focus();
		expect(document.activeElement).toBe(checkbox);

		unmount();
		expect(objectRef.current).toBeNull();
		expect(callbackRef).toHaveBeenLastCalledWith(null);
	});

	it("FormData 只提交选中且未禁用的字段，value 默认为 on", () => {
		const { container } = render(
			<form>
				<Checkbox name="notifications" value="email" defaultChecked aria-label="邮件" />
				<Checkbox name="notifications" value="sms" aria-label="短信" />
				<Checkbox name="terms" defaultChecked aria-label="条款" />
				<Checkbox
					name="unavailable"
					value="hidden"
					defaultChecked
					disabled
					aria-label="禁用"
				/>
				<Checkbox name="all" checked="indeterminate" aria-label="全部" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(Array.from(new FormData(form).entries())).toEqual([
			["notifications", "email"],
			["terms", "on"],
		]);
		fireEvent.click(screen.getByRole("checkbox", { name: "短信" }));
		expect(new FormData(form).getAll("notifications")).toEqual(["email", "sms"]);
		fireEvent.click(screen.getByRole("checkbox", { name: "邮件" }));
		expect(new FormData(form).getAll("notifications")).toEqual(["sms"]);
	});

	it("form 属性使表单外控件参与指定表单提交", () => {
		const { container } = render(
			<>
				<form id="external-form" />
				<Checkbox
					form="external-form"
					name="option"
					value="enabled"
					defaultChecked
					aria-label="外部选项"
				/>
			</>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(new FormData(form).get("option")).toBe("enabled");
		fireEvent.click(screen.getByRole("checkbox", { name: "外部选项" }));
		expect(new FormData(form).has("option")).toBe(false);
	});

	it.each([
		false,
		true,
	] as const)("外部 form reset 同时恢复初值 %s 与表单值", async (defaultChecked) => {
		const ref = createRef<HTMLButtonElement>();
		const { container } = render(
			<>
				<form id="reset-external" />
				<Checkbox
					ref={ref}
					form="reset-external"
					name="option"
					value="enabled"
					defaultChecked={defaultChecked}
					aria-label="外部重置选项"
				/>
			</>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		const checkbox = screen.getByRole("checkbox", { name: "外部重置选项" });
		expect(ref.current).toBe(checkbox);
		expect(ref.current?.form).toBe(form);
		fireEvent.click(checkbox);
		expect(checkbox.getAttribute("aria-checked")).toBe(String(!defaultChecked));
		expect(new FormData(form).has("option")).toBe(!defaultChecked);
		await act(async () => form.reset());
		expect(checkbox.getAttribute("aria-checked")).toBe(String(defaultChecked));
		expect(new FormData(form).get("option")).toBe(defaultChecked ? "enabled" : null);
	});

	it.each([
		false,
		true,
	] as const)("reset 恢复非受控初始值 %s 及其表单值", async (defaultChecked) => {
		const { container } = render(
			<form>
				<Checkbox name="option" defaultChecked={defaultChecked} aria-label="恢复初值" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		const checkbox = screen.getByRole("checkbox", { name: "恢复初值" });
		fireEvent.click(checkbox);
		expect(checkbox.getAttribute("aria-checked")).toBe(String(!defaultChecked));
		await act(async () => form.reset());
		expect(checkbox.getAttribute("aria-checked")).toBe(String(defaultChecked));
		expect(new FormData(form).has("option")).toBe(defaultChecked);
	});

	it.each([
		false,
		true,
	] as const)("取消 reset 保留当前非受控值 %s 且不请求初值", async (defaultChecked) => {
		const change = vi.fn();
		const reset = vi.fn((event) => event.preventDefault());
		const { container } = render(
			<form onReset={reset}>
				<Checkbox
					name="option"
					defaultChecked={defaultChecked}
					onCheckedChange={change}
					aria-label="取消恢复选项"
				/>
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		const checkbox = screen.getByRole("checkbox", { name: "取消恢复选项" });
		fireEvent.click(checkbox);
		change.mockClear();
		await act(async () => form.reset());
		expect(reset).toHaveBeenCalledOnce();
		expect(change).not.toHaveBeenCalled();
		expect(checkbox.getAttribute("aria-checked")).toBe(String(!defaultChecked));
		expect(new FormData(form).has("option")).toBe(!defaultChecked);
	});

	it("取消 reset 不触发受控回调或覆盖宿主当前值", async () => {
		const change = vi.fn();
		function Preference() {
			const [checked, setChecked] = useState(false);
			return (
				<form onReset={(event) => event.preventDefault()}>
					<Checkbox
						name="option"
						checked={checked}
						onCheckedChange={(next) => {
							change(next);
							setChecked(next === true);
						}}
						aria-label="受控取消选项"
					/>
				</form>
			);
		}
		const { container } = render(<Preference />);
		const form = container.querySelector("form") as HTMLFormElement;
		const checkbox = screen.getByRole("checkbox", { name: "受控取消选项" });
		fireEvent.click(checkbox);
		change.mockClear();
		await act(async () => form.reset());
		expect(change).not.toHaveBeenCalled();
		expect(checkbox.getAttribute("aria-checked")).toBe("true");
		expect(new FormData(form).get("option")).toBe("on");
	});

	it("受控宿主不接受正常 reset 请求时，可见状态与表单值保持一致", async () => {
		const change = vi.fn();
		const preference = (checked: boolean) => (
			<form>
				<Checkbox
					checked={checked}
					onCheckedChange={change}
					name="option"
					aria-label="宿主持值"
				/>
			</form>
		);
		const { container, rerender } = render(preference(false));
		const form = container.querySelector("form") as HTMLFormElement;
		rerender(preference(true));
		await act(async () => form.reset());
		expect(change).toHaveBeenCalledOnce();
		expect(change).toHaveBeenCalledWith(false);
		expect(
			screen.getByRole("checkbox", { name: "宿主持值" }).getAttribute("aria-checked"),
		).toBe("true");
		expect(new FormData(form).get("option")).toBe("on");
	});

	it("表单晚挂载后，reset 恢复之前已修改的非受控值", async () => {
		const change = vi.fn();
		const ref = createRef<HTMLButtonElement>();
		const preference = (mounted: boolean) => (
			<>
				<Checkbox
					ref={ref}
					form="late-normal"
					defaultChecked
					name="option"
					aria-label="晚挂重置"
					onCheckedChange={change}
				/>
				{mounted && <form id="late-normal" />}
			</>
		);
		const { container, rerender } = render(preference(false));
		const control = screen.getByRole("checkbox", { name: "晚挂重置" });
		expect(ref.current?.form).toBeNull();
		fireEvent.click(control);
		rerender(preference(true));
		const form = container.querySelector("form") as HTMLFormElement;
		expect(ref.current).toBe(control);
		expect(ref.current?.form).toBe(form);
		change.mockClear();
		await act(async () => form.reset());
		expect(control.getAttribute("aria-checked")).toBe("true");
		expect(new FormData(form).get("option")).toBe("on");
		expect(change.mock.calls).toEqual([[true]]);
	});

	it("晚挂表单取消 reset 后，可见状态与提交值不变且不回调", async () => {
		const change = vi.fn();
		const preference = (mounted: boolean) => (
			<>
				<Checkbox
					form="late-canceled"
					defaultChecked
					name="option"
					aria-label="晚挂取消"
					onCheckedChange={change}
				/>
				{mounted && <form id="late-canceled" onReset={(event) => event.preventDefault()} />}
			</>
		);
		const { container, rerender } = render(preference(false));
		rerender(preference(true));
		const form = container.querySelector("form") as HTMLFormElement;
		const control = screen.getByRole("checkbox", { name: "晚挂取消" });
		fireEvent.click(control);
		change.mockClear();
		await act(async () => form.reset());
		expect(control.getAttribute("aria-checked")).toBe("false");
		expect(new FormData(form).has("option")).toBe(false);
		expect(change).not.toHaveBeenCalled();
	});

	it.each([
		false,
		true,
	] as const)("同 ID 替换表单后，仅新归属 reset 生效，取消=%s", async (canceled) => {
		const ref = createRef<HTMLButtonElement>();
		const change = vi.fn();
		const preference = (generation: number) => (
			<>
				<form
					key={generation}
					id="replace-form"
					onReset={(event) => {
						if (generation > 0 && canceled) event.preventDefault();
					}}
				/>
				<Checkbox
					form="replace-form"
					ref={ref}
					defaultChecked
					name="option"
					aria-label="替换表单"
					onCheckedChange={change}
				/>
			</>
		);
		const { container, rerender } = render(preference(0));
		const firstForm = container.querySelector("form") as HTMLFormElement;
		const control = screen.getByRole("checkbox", { name: "替换表单" });
		fireEvent.click(control);
		rerender(preference(1));
		const currentForm = container.querySelector("form") as HTMLFormElement;
		expect(currentForm).not.toBe(firstForm);
		expect(firstForm.isConnected).toBe(false);
		expect(ref.current).toBe(control);
		expect(ref.current?.form).toBe(currentForm);
		change.mockClear();
		await act(async () => firstForm.reset());
		expect(control.getAttribute("aria-checked")).toBe("false");
		expect(new FormData(currentForm).has("option")).toBe(false);
		expect(change).not.toHaveBeenCalled();
		await act(async () => currentForm.reset());
		expect(control.getAttribute("aria-checked")).toBe(canceled ? "false" : "true");
		expect(new FormData(currentForm).has("option")).toBe(!canceled);
		expect(change.mock.calls).toEqual(canceled ? [] : [[true]]);
	});

	it.each([
		false,
		true,
		"indeterminate",
	] as const)("reset 到已有初值 %s 不产生多余通知", async (defaultChecked) => {
		const change = vi.fn();
		const { container } = render(
			<form>
				<Checkbox
					defaultChecked={defaultChecked}
					onCheckedChange={change}
					name="option"
					aria-label="同值恢复"
				/>
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		await act(async () => {
			form.reset();
			form.reset();
		});
		expect(
			screen.getByRole("checkbox", { name: "同值恢复" }).getAttribute("aria-checked"),
		).toBe(defaultChecked === "indeterminate" ? "mixed" : String(defaultChecked));
		expect(new FormData(form).has("option")).toBe(defaultChecked === true);
		expect(change).not.toHaveBeenCalled();
	});

	it("required 同时暴露 ARIA 与表单约束，勾选后满足约束", () => {
		const { container } = render(
			<form>
				<Checkbox name="terms" required aria-label="必选条款" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		const checkbox = screen.getByRole("checkbox", { name: "必选条款" });
		expect(checkbox.getAttribute("aria-required")).toBe("true");
		expect(form.checkValidity()).toBe(false);
		fireEvent.click(checkbox);
		expect(form.checkValidity()).toBe(true);
	});

	it("桥接 input 的校验聚焦交回可见 Root，并保留 Root onFocus", () => {
		const focus = vi.fn();
		const { container } = render(
			<form>
				<Checkbox
					name="terms"
					required
					aria-label="校验条款"
					onFocus={(event) => focus(event.currentTarget)}
				/>
			</form>,
		);
		const checkbox = screen.getByRole("checkbox", { name: "校验条款" });
		const bridge = container.querySelector('input[type="checkbox"][aria-hidden="true"]');
		expect(bridge).not.toBeNull();
		act(() => (bridge as HTMLInputElement).focus());
		expect(document.activeElement).toBe(checkbox);
		expect(focus).toHaveBeenCalledOnce();
		expect(focus).toHaveBeenCalledWith(checkbox);
	});

	it("checkValidity 仅检查约束，不夺取其他字段的焦点", () => {
		const { container } = render(
			<form>
				<input aria-label="当前输入" />
				<Checkbox name="terms" required aria-label="必选项" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		const input = screen.getByRole("textbox", { name: "当前输入" });
		act(() => input.focus());
		expect(form.checkValidity()).toBe(false);
		expect(document.activeElement).toBe(input);
	});

	it.each([
		"object",
		"callback",
	] as const)("form 换绑保留节点与状态，reset 只跟随新归属并保留 %s ref", async (refType) => {
		const objectRef = createRef<HTMLButtonElement>();
		let callbackNode: HTMLButtonElement | null = null;
		const callbackRef = vi.fn((node: HTMLButtonElement | null) => {
			callbackNode = node;
		});
		const readRef = () => (refType === "object" ? objectRef.current : callbackNode);
		const preference = (formId: string) => (
			<>
				<form id="first-form" />
				<form id="second-form" />
				<Checkbox
					ref={refType === "object" ? objectRef : callbackRef}
					form={formId}
					name="option"
					value="enabled"
					defaultChecked
					aria-label="换绑选项"
				/>
			</>
		);
		const { container, rerender, unmount } = render(preference("first-form"));
		const firstForm = container.querySelector("#first-form") as HTMLFormElement;
		const secondForm = container.querySelector("#second-form") as HTMLFormElement;
		const firstControl = screen.getByRole("checkbox", { name: "换绑选项" });
		expect(readRef()).toBe(firstControl);
		fireEvent.click(firstControl);
		rerender(preference("second-form"));
		const control = screen.getByRole("checkbox", { name: "换绑选项" });
		expect(control).toBe(firstControl);
		expect(firstControl.isConnected).toBe(true);
		expect(readRef()).toBe(control);
		expect(readRef()?.form).toBe(secondForm);
		expect(control.getAttribute("aria-checked")).toBe("false");
		await act(async () => firstForm.reset());
		expect(control.getAttribute("aria-checked")).toBe("false");
		expect(new FormData(firstForm).has("option")).toBe(false);
		await act(async () => secondForm.reset());
		expect(control.getAttribute("aria-checked")).toBe("true");
		expect(new FormData(secondForm).get("option")).toBe("enabled");
		if (refType === "callback") {
			expect(callbackRef.mock.calls.map(([node]) => node)).toEqual([control]);
		}
		unmount();
		expect(readRef()).toBeNull();
		if (refType === "callback") expect(callbackRef).toHaveBeenLastCalledWith(null);
	});

	it.each([
		false,
		true,
	] as const)("form 换绑保留节点，新的 disabled=%s 继续使用原生禁用属性", (disabled) => {
		const preference = (form: string, isDisabled: boolean) => (
			<>
				<form id="focus-first" />
				<form id="focus-second" />
				<Checkbox form={form} disabled={isDisabled} aria-label="焦点换绑" />
			</>
		);
		const { rerender } = render(preference("focus-first", false));
		const firstControl = screen.getByRole("checkbox", { name: "焦点换绑" });
		act(() => firstControl.focus());
		rerender(preference("focus-second", disabled));
		const control = screen.getByRole("checkbox", { name: "焦点换绑" });
		expect(control).toBe(firstControl);
		expect((control as HTMLButtonElement).disabled).toBe(disabled);
		if (!disabled) expect(document.activeElement).toBe(control);
	});

	it("form 换绑与卸载保留 React 19 callback ref 返回的清理", () => {
		const cleanup = vi.fn();
		const callbackRef = vi.fn((node: HTMLButtonElement | null) => {
			if (node) return () => cleanup(node);
		});
		const preference = (form: string) => (
			<>
				<form id="cleanup-first" />
				<form id="cleanup-second" />
				<Checkbox form={form} ref={callbackRef} aria-label="清理换绑" />
			</>
		);
		const { rerender, unmount } = render(preference("cleanup-first"));
		const firstControl = screen.getByRole("checkbox", { name: "清理换绑" });
		rerender(preference("cleanup-second"));
		const control = screen.getByRole("checkbox", { name: "清理换绑" });
		expect(control).toBe(firstControl);
		expect(cleanup).not.toHaveBeenCalled();
		expect(callbackRef.mock.calls.map(([node]) => node)).toEqual([control]);
		unmount();
		expect(cleanup.mock.calls.map(([node]) => node)).toEqual([control]);
		expect(callbackRef).not.toHaveBeenCalledWith(null);
	});

	it("原生属性与局部覆盖归属真实 button，recipe 只输出 BEM 类", () => {
		render(
			<Checkbox
				id="styled"
				aria-label="样式选项"
				aria-describedby="option-description"
				aria-invalid="true"
				variant="primary"
				size="lg"
				className="host-layout"
				style={{ marginInlineStart: 8 }}
			/>,
		);
		const checkbox = screen.getByRole("checkbox", { name: "样式选项" });
		expect(checkbox.id).toBe("styled");
		expect(checkbox.getAttribute("aria-describedby")).toBe("option-description");
		expect(checkbox.getAttribute("aria-invalid")).toBe("true");
		expect(checkbox.getAttribute("data-size")).toBe("lg");
		expect(checkbox.getAttribute("data-variant")).toBe("primary");
		expect(checkbox.classList.contains("host-layout")).toBe(true);
		expect(checkbox.style.marginInlineStart).toBe("8px");
		expect(checkboxVariants({ variant: "primary", size: "lg" }).split(" ")).toEqual([
			"v-checkbox",
			"v-checkbox--primary",
			"v-checkbox--lg",
		]);
	});

	it("SSR 输出三态名称、关联 ID 与可提交的非受控初值", () => {
		const html = renderToString(
			<form>
				<Checkbox id="ssr-checkbox" name="terms" defaultChecked />
				<Label htmlFor="ssr-checkbox">确认条款</Label>
				<Checkbox checked="indeterminate" aria-label="全选" />
			</form>,
		);
		expect(html).toContain('id="ssr-checkbox"');
		expect(html).toContain('for="ssr-checkbox"');
		expect(html).toContain('name="terms"');
		expect(html).toContain('checked=""');
		expect(html).toContain('aria-checked="mixed"');
	});

	it("SSR hydration 保留宿主生成的关联 ID 与表单初值", async () => {
		function Preference() {
			const id = useId();
			return (
				<form>
					<Checkbox id={id} name="terms" defaultChecked />
					<Label htmlFor={id}>确认条款</Label>
				</form>
			);
		}
		const container = document.createElement("div");
		container.innerHTML = renderToString(<Preference />);
		document.body.append(container);
		const serverId = container.querySelector("button")?.id;
		const recoverableError = vi.fn();
		let root: ReturnType<typeof hydrateRoot> | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(container, <Preference />, {
					onRecoverableError: recoverableError,
				});
			});
			const checkbox = screen.getByRole("checkbox", { name: "确认条款" });
			const form = container.querySelector("form") as HTMLFormElement;
			expect(checkbox.id).toBe(serverId);
			expect(container.querySelector("label")?.htmlFor).toBe(serverId);
			expect(new FormData(form).get("terms")).toBe("on");
			fireEvent.click(checkbox);
			expect(new FormData(form).has("terms")).toBe(false);
			expect(recoverableError).not.toHaveBeenCalled();
		} finally {
			await act(async () => root?.unmount());
			container.remove();
		}
	});
});
