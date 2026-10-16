import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Input } from "../input";

const clearLabel = "清除测试字段";

describe("Input", () => {
	it("受控值由消费方更新，onChange 保留原生事件", () => {
		const change = vi.fn();
		const { rerender } = render(
			<Input
				label="姓名"
				value="初值"
				onChange={(event) => change(event.currentTarget.value)}
			/>,
		);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name: "姓名" });
		fireEvent.change(input, { target: { value: "编辑值" } });
		expect(change).toHaveBeenCalledExactlyOnceWith("编辑值");
		expect(input.value).toBe("初值");
		rerender(<Input label="姓名" value="新值" onChange={change} />);
		expect(input.value).toBe("新值");
	});

	it("非受控值参与 FormData，清除派发一次真实 input 事件并恢复焦点", () => {
		const nativeInput = vi.fn();
		const change = vi.fn((event) => [
			event.currentTarget,
			event.currentTarget.value,
			event.nativeEvent,
		]);
		const { container } = render(
			<form>
				<Input
					label="姓名"
					name="name"
					defaultValue="初值"
					clearable
					clearLabel={clearLabel}
					onChange={change}
				/>
				<Input name="disabled" defaultValue="排除" disabled />
			</form>,
		);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name: "姓名" });
		const form = container.querySelector("form");
		if (!form) throw new Error("Missing form");
		input.addEventListener("input", nativeInput);
		fireEvent.click(screen.getByRole("button", { name: clearLabel }));
		expect(input.value).toBe("");
		expect(document.activeElement).toBe(input);
		expect(change).toHaveBeenCalledOnce();
		expect(nativeInput).toHaveBeenCalledOnce();
		expect(change.mock.results[0]?.value).toEqual([input, "", nativeInput.mock.calls[0]?.[0]]);
		expect(new FormData(form).get("name")).toBe("");
		expect(new FormData(form).has("disabled")).toBe(false);
		expect(screen.queryByRole("button", { name: clearLabel })).toBeNull();
	});

	it("消费方拒绝清除时受控 DOM 值和清除按钮保持原值", () => {
		const change = vi.fn((event) => event.currentTarget.value);
		render(
			<Input label="姓名" value="保留" clearable clearLabel={clearLabel} onChange={change} />,
		);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name: "姓名" });
		fireEvent.click(screen.getByRole("button", { name: clearLabel }));
		expect(change).toHaveBeenCalledOnce();
		expect(change.mock.results[0]?.value).toBe("");
		expect(input.value).toBe("保留");
		expect(screen.getByRole("button", { name: clearLabel })).toBeTruthy();
		expect(document.activeElement).toBe(input);
	});

	it("消费方接受清除后更新同一个 input 的受控值", () => {
		function ControlledInput() {
			const [value, setValue] = useState("初值");
			return (
				<Input
					label="姓名"
					value={value}
					onChange={(event) => setValue(event.currentTarget.value)}
					clearable
					clearLabel={clearLabel}
				/>
			);
		}
		render(<ControlledInput />);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name: "姓名" });
		fireEvent.click(screen.getByRole("button", { name: clearLabel }));
		expect(input.value).toBe("");
		expect(document.activeElement).toBe(input);
		expect(screen.getByRole("textbox", { name: "姓名" })).toBe(input);
	});

	it.each(["", "初值"])("reset 恢复非受控初值 %s 及清除可用状态", async (defaultValue) => {
		const { container } = render(
			<form>
				<Input
					label="姓名"
					name="name"
					defaultValue={defaultValue}
					clearable
					clearLabel={clearLabel}
				/>
			</form>,
		);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name: "姓名" });
		const form = container.querySelector("form");
		if (!form) throw new Error("Missing form");
		fireEvent.change(input, { target: { value: defaultValue ? "" : "编辑值" } });
		await act(async () => form.reset());
		expect(input.value).toBe(defaultValue);
		expect(new FormData(form).get("name")).toBe(defaultValue);
		expect(Boolean(screen.queryByRole("button", { name: clearLabel }))).toBe(
			Boolean(defaultValue),
		);
	});

	it("取消 reset 保留值和清除操作，不生成 onChange", async () => {
		const change = vi.fn();
		const { container } = render(
			<form onReset={(event) => event.preventDefault()}>
				<Input
					label="姓名"
					defaultValue=""
					clearable
					clearLabel={clearLabel}
					onChange={change}
				/>
			</form>,
		);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name: "姓名" });
		const form = container.querySelector("form");
		if (!form) throw new Error("Missing form");
		fireEvent.change(input, { target: { value: "保留" } });
		change.mockClear();
		await act(async () => form.reset());
		expect(input.value).toBe("保留");
		expect(screen.getByRole("button", { name: clearLabel })).toBeTruthy();
		expect(change).not.toHaveBeenCalled();
	});

	it("外部 form 及动态表单归属的 reset 只同步当前所属字段", async () => {
		const field = (form: string) => (
			<Input label="姓名" form={form} defaultValue="" clearable clearLabel={clearLabel} />
		);
		const { container, rerender } = render(
			<>
				<form id="first" />
				<form id="second" />
				{field("first")}
			</>,
		);
		const first = container.querySelector<HTMLFormElement>("#first");
		const second = container.querySelector<HTMLFormElement>("#second");
		if (!first || !second) throw new Error("Missing forms");
		const input = screen.getByRole<HTMLInputElement>("textbox", { name: "姓名" });
		fireEvent.change(input, { target: { value: "编辑值" } });
		rerender(
			<>
				<form id="first" />
				<form id="second" />
				{field("second")}
			</>,
		);
		await act(async () => first.reset());
		expect(input.value).toBe("编辑值");
		expect(screen.getByRole("button", { name: clearLabel })).toBeTruthy();
		await act(async () => second.reset());
		expect(input.value).toBe("");
		expect(screen.queryByRole("button", { name: clearLabel })).toBeNull();
	});

	it.each(["detached", "shadow"])("%s 作用域 reset 同步非受控清除操作", async (scope) => {
		const host = document.createElement("div");
		const container = document.createElement("div");
		if (scope === "shadow") host.attachShadow({ mode: "open" }).append(container);
		const view = render(
			<form>
				<Input label="姓名" defaultValue="" clearable clearLabel={clearLabel} />
			</form>,
			{ container },
		);
		try {
			const input = view.getByRole("textbox", { name: "姓名" });
			if (!(input instanceof HTMLInputElement)) throw new Error("Missing input");
			const form = container.querySelector("form");
			if (!form) throw new Error("Missing form");
			fireEvent.change(input, { target: { value: "编辑值" } });
			await act(async () => form.reset());
			expect(input.value).toBe("");
			expect(view.queryByRole("button", { name: clearLabel })).toBeNull();
		} finally {
			view.unmount();
		}
	});

	it.each(["disabled", "readOnly"] as const)("%s 禁止清除与密码切换", (state) => {
		render(
			<Input
				label="密码"
				type="password"
				defaultValue="保留"
				clearable
				clearLabel={clearLabel}
				passwordToggle
				showPasswordLabel="查看测试密码"
				{...{ [state]: true }}
			/>,
		);
		expect(screen.queryByRole("button", { name: clearLabel })).toBeNull();
		expect(
			screen.getByRole<HTMLButtonElement>("button", { name: "查看测试密码" }).disabled,
		).toBe(true);
	});

	it("密码切换保留节点和值，按下状态与输入类型一致", () => {
		render(
			<Input
				label="密码"
				type="password"
				defaultValue="secret"
				passwordToggle
				showPasswordLabel="查看测试密码"
				hidePasswordLabel="遮蔽测试密码"
			/>,
		);
		const input = screen.getByLabelText<HTMLInputElement>("密码");
		fireEvent.click(screen.getByRole("button", { name: "查看测试密码" }));
		expect(input.type).toBe("text");
		expect(input.value).toBe("secret");
		expect(
			screen.getByRole("button", { name: "遮蔽测试密码" }).getAttribute("aria-pressed"),
		).toBe("true");
		expect(document.activeElement).toBe(input);
		fireEvent.click(screen.getByRole("button", { name: "遮蔽测试密码" }));
		expect(input.type).toBe("password");
		expect(
			screen.getByRole("button", { name: "查看测试密码" }).getAttribute("aria-pressed"),
		).toBe("false");
		expect(screen.getByLabelText("密码")).toBe(input);
	});

	it("非 password 类型不提供密码按钮", () => {
		render(<Input label="姓名" passwordToggle />);
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("切换 label 和辅助操作不替换原生 input，也不丢失非受控值", () => {
		const { rerender } = render(<Input aria-label="姓名" defaultValue="初值" />);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name: "姓名" });
		fireEvent.change(input, { target: { value: "编辑值" } });
		rerender(<Input label="姓名" clearable leading={<span>姓名图标</span>} />);
		expect(screen.getByRole("textbox", { name: "姓名" })).toBe(input);
		expect(input.value).toBe("编辑值");
	});

	it("重复实例生成唯一且稳定的 input 与说明关联 ID", () => {
		const { rerender } = render(
			<>
				<Input label="用户名" description="用于登录" />
				<Input label="邮箱" description="用于通知" />
			</>,
		);
		const username = screen.getByRole<HTMLInputElement>("textbox", { name: "用户名" });
		const email = screen.getByRole<HTMLInputElement>("textbox", { name: "邮箱" });
		const usernameId = username.id;
		expect(usernameId).not.toBe("");
		expect(email.id).not.toBe(usernameId);
		expect(
			document.getElementById(username.getAttribute("aria-describedby") ?? "")?.textContent,
		).toBe("用于登录");
		expect(
			document.getElementById(email.getAttribute("aria-describedby") ?? "")?.textContent,
		).toBe("用于通知");
		rerender(
			<>
				<Input label="用户名" description="更新说明" />
				<Input label="邮箱" />
			</>,
		);
		expect(screen.getByRole("textbox", { name: "用户名" }).id).toBe(usernameId);
	});

	it("宿主 ID 去重，移除说明或错误后只关联实际存在的内部节点", () => {
		const { rerender } = render(
			<>
				<p id="external">宿主说明</p>
				<Input
					id="email"
					label="邮箱"
					description="联系邮箱"
					errorMessage="格式不正确"
					invalid
					aria-describedby="external external email-description email-error"
				/>
			</>,
		);
		const input = screen.getByRole("textbox", { name: "邮箱" });
		expect(input.id).toBe("email");
		expect(input.getAttribute("aria-describedby")).toBe(
			"external email-description email-error",
		);
		rerender(
			<>
				<p id="external">宿主说明</p>
				<Input
					id="email"
					label="邮箱"
					errorMessage="格式不正确"
					invalid={false}
					aria-describedby="external external"
				/>
			</>,
		);
		expect(input.getAttribute("aria-describedby")).toBe("external");
		expect(document.getElementById("email-description")).toBeNull();
		expect(document.getElementById("email-error")).toBeNull();
	});

	it("宿主可使用内部 ID 格式的名称，不被错误过滤", () => {
		render(
			<>
				<p id="email-description">宿主说明</p>
				<p id="email-error">宿主错误</p>
				<Input
					id="email"
					label="邮箱"
					aria-describedby="email-description email-error email-description"
				/>
			</>,
		);
		expect(screen.getByRole("textbox", { name: "邮箱" }).getAttribute("aria-describedby")).toBe(
			"email-description email-error",
		);
	});

	it("省略辅助内容不生成悬空关联，错误仅在 invalid 时出现", () => {
		render(<Input label="标题" errorMessage="尚未出错" description={false} />);
		const input = screen.getByRole("textbox", { name: "标题" });
		expect(input.hasAttribute("aria-describedby")).toBe(false);
		expect(input.hasAttribute("aria-invalid")).toBe(false);
		expect(screen.queryByText("尚未出错")).toBeNull();
	});

	it.each([
		"grammar",
		"spelling",
	] as const)("aria-invalid=%s 保留语义，显式 invalid 可覆盖", (ariaInvalid) => {
		const { rerender } = render(
			<Input label="标题" aria-invalid={ariaInvalid} errorMessage="请检查文字" />,
		);
		const input = screen.getByRole("textbox", { name: "标题" });
		expect(input.getAttribute("aria-invalid")).toBe(ariaInvalid);
		expect(
			document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent,
		).toBe("请检查文字");
		rerender(
			<Input
				label="标题"
				aria-invalid={ariaInvalid}
				invalid={false}
				errorMessage="请检查文字"
			/>,
		);
		expect(input.getAttribute("aria-invalid")).toBe("false");
		expect(screen.queryByText("请检查文字")).toBeNull();
	});

	it("label、description 和 error 的 ReactNode 数字 0 均有效", () => {
		render(<Input label={0} description={0} invalid errorMessage={0} />);
		const input = screen.getByRole("textbox", { name: "0" });
		const ids = input.getAttribute("aria-describedby")?.split(" ") ?? [];
		expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual(["0", "0"]);
	});

	it("callback ref cleanup 保留 React 19 语义，重渲染不重复 attach", () => {
		const cleanup = vi.fn();
		const ref = vi.fn(() => cleanup);
		const { rerender, unmount } = render(<Input ref={ref} label="姓名" />);
		const input = screen.getByRole("textbox", { name: "姓名" });
		expect(ref).toHaveBeenCalledExactlyOnceWith(input);
		rerender(<Input ref={ref} label="姓名" clearable />);
		expect(ref).toHaveBeenCalledOnce();
		expect(cleanup).not.toHaveBeenCalled();
		unmount();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(ref).toHaveBeenCalledOnce();
	});

	it("普通 callback ref 和 object ref 在卸载时置空", () => {
		const objectRef = createRef<HTMLInputElement>();
		const callbackRef = vi.fn();
		const { unmount } = render(
			<>
				<Input ref={objectRef} label="姓名" />
				<Input ref={callbackRef} label="邮箱" />
			</>,
		);
		expect(objectRef.current).toBe(screen.getByRole("textbox", { name: "姓名" }));
		expect(callbackRef).toHaveBeenCalledWith(screen.getByRole("textbox", { name: "邮箱" }));
		unmount();
		expect(objectRef.current).toBeNull();
		expect(callbackRef.mock.calls.at(-1)?.[0]).toBeNull();
	});

	it("SSR 水合支持有无 label，保留节点、关联 ID 及后续事件", async () => {
		const change = vi.fn();
		const ui = (
			<>
				<Input
					label={<strong>用户名</strong>}
					description="用于登录"
					defaultValue="初值"
					clearable
					onChange={change}
				/>
				<Input aria-label="邮箱" invalid errorMessage="请输入邮箱" />
				<Input label={0} description={0} />
			</>
		);
		const container = document.createElement("div");
		container.innerHTML = renderToString(ui);
		document.body.append(container);
		const serverInputs = [...container.querySelectorAll("input")];
		const serverIds = [...container.querySelectorAll("[id]")].map((element) => element.id);
		const recoverableError = vi.fn();
		let root: Root | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(container, ui, { onRecoverableError: recoverableError });
			});
			expect([...container.querySelectorAll("input")]).toEqual(serverInputs);
			expect([...container.querySelectorAll("[id]")].map((element) => element.id)).toEqual(
				serverIds,
			);
			expect(recoverableError).not.toHaveBeenCalled();
			fireEvent.change(screen.getByRole("textbox", { name: "用户名" }), {
				target: { value: "水合后输入" },
			});
			expect(change).toHaveBeenCalledOnce();
			expect(
				screen.getByRole<HTMLInputElement>("textbox", { name: "邮箱" }).labels?.length,
			).toBe(0);
		} finally {
			await act(async () => root?.unmount());
			container.remove();
		}
	});
});
