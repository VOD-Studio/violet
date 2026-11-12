import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "../input";

const name = "测试字段";

function stubClipboard(writeText: (text: string) => Promise<void>) {
	Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

afterEach(() => {
	Reflect.deleteProperty(navigator, "clipboard");
	vi.useRealTimers();
});

describe("Input 值与原生语义", () => {
	it("受控值由消费方更新，onChange 保留原生事件", () => {
		const change = vi.fn();
		const { rerender } = render(
			<Input
				aria-label={name}
				value="初值"
				onChange={(event) => change(event.currentTarget.value)}
			/>,
		);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		fireEvent.change(input, { target: { value: "编辑值" } });
		expect(change).toHaveBeenCalledExactlyOnceWith("编辑值");
		expect(input.value).toBe("初值");
		rerender(<Input aria-label={name} value="新值" onChange={change} />);
		expect(input.value).toBe("新值");
	});

	it("id 缺省由 useId 生成且稳定，宿主 id 与 aria-describedby 原样透传", () => {
		const { rerender } = render(
			<>
				<p id="hint">宿主说明</p>
				<Input aria-label="甲" />
				<Input aria-label="乙" id="email" aria-describedby="hint" />
			</>,
		);
		const first = screen.getByRole<HTMLInputElement>("textbox", { name: "甲" });
		const second = screen.getByRole<HTMLInputElement>("textbox", { name: "乙" });
		const firstId = first.id;
		expect(firstId).not.toBe("");
		expect(second.id).toBe("email");
		expect(second.getAttribute("aria-describedby")).toBe("hint");
		expect(first.hasAttribute("aria-describedby")).toBe(false);
		rerender(
			<>
				<p id="hint">宿主说明</p>
				<Input aria-label="甲" placeholder="更新" />
				<Input aria-label="乙" id="email" aria-describedby="hint" />
			</>,
		);
		expect(screen.getByRole("textbox", { name: "甲" }).id).toBe(firstId);
	});

	it("className、style、name、form 与 ref 都落在原生 input 上，外壳不接收", () => {
		const ref = createRef<HTMLInputElement>();
		const { container, unmount } = render(
			<Input
				ref={ref}
				aria-label={name}
				name="query"
				form="outer"
				className="from-caller"
				style={{ color: "red" }}
				classNames={{ control: "shell", input: "inner" }}
			/>,
		);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		expect(ref.current).toBe(input);
		expect(input.classList.contains("from-caller")).toBe(true);
		expect(input.classList.contains("inner")).toBe(true);
		expect(input.style.color).toBe("red");
		expect(input.getAttribute("form")).toBe("outer");
		const shell = container.firstElementChild;
		expect(shell?.classList.contains("shell")).toBe(true);
		expect(shell?.classList.contains("from-caller")).toBe(false);
		expect(shell).toBe(input.parentElement);
		unmount();
		expect(ref.current).toBeNull();
	});

	it("callback ref 保留 React 19 cleanup，重渲染不重复 attach", () => {
		const cleanup = vi.fn();
		const ref = vi.fn(() => cleanup);
		const { rerender, unmount } = render(<Input ref={ref} aria-label={name} />);
		const input = screen.getByRole("textbox", { name });
		expect(ref).toHaveBeenCalledExactlyOnceWith(input);
		rerender(<Input ref={ref} aria-label={name} clearable />);
		expect(ref).toHaveBeenCalledOnce();
		expect(cleanup).not.toHaveBeenCalled();
		unmount();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(ref).toHaveBeenCalledOnce();
	});

	it("切换辅助槽不替换原生 input，也不丢失非受控值", () => {
		const { rerender } = render(<Input aria-label={name} defaultValue="初值" />);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		fireEvent.change(input, { target: { value: "编辑值" } });
		rerender(<Input aria-label={name} clearable leading={<span>图标</span>} invalid />);
		expect(screen.getByRole("textbox", { name })).toBe(input);
		expect(input.value).toBe("编辑值");
	});

	it("按下外壳空白处聚焦输入区，按下按钮不被劫持", () => {
		const { container } = render(
			<Input aria-label={name} leading="https://" defaultValue="x" clearable />,
		);
		const input = screen.getByRole("textbox", { name });
		const shell = container.firstElementChild as HTMLElement;
		expect(fireEvent.mouseDown(shell)).toBe(false);
		expect(document.activeElement).toBe(input);
		expect(fireEvent.mouseDown(screen.getByRole("button", { name: "清除" }))).toBe(true);
	});
});

describe("Input 清除", () => {
	it("非受控值参与 FormData，清除派发一次真实 input 事件、恢复焦点并触发 onClear", () => {
		const nativeInput = vi.fn();
		const clear = vi.fn();
		const change = vi.fn((event) => [
			event.currentTarget,
			event.currentTarget.value,
			event.nativeEvent,
		]);
		const { container } = render(
			<form>
				<Input
					aria-label={name}
					name="name"
					defaultValue="初值"
					clearable
					onClear={clear}
					onChange={change}
				/>
				<Input aria-label="禁用" name="disabled" defaultValue="排除" disabled />
			</form>,
		);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		const form = container.querySelector("form");
		if (!form) throw new Error("Missing form");
		input.addEventListener("input", nativeInput);
		fireEvent.click(screen.getByRole("button", { name: "清除" }));
		expect(input.value).toBe("");
		expect(document.activeElement).toBe(input);
		expect(change).toHaveBeenCalledOnce();
		expect(nativeInput).toHaveBeenCalledOnce();
		expect(clear).toHaveBeenCalledOnce();
		expect(change.mock.results[0]?.value).toEqual([input, "", nativeInput.mock.calls[0]?.[0]]);
		expect(new FormData(form).get("name")).toBe("");
		expect(new FormData(form).has("disabled")).toBe(false);
		expect(screen.queryByRole("button", { name: "清除" })).toBeNull();
	});

	it("clearLabel 覆盖默认名称「清除」", () => {
		render(<Input aria-label={name} defaultValue="x" clearable clearLabel="清空字段" />);
		expect(screen.getByRole("button", { name: "清空字段" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "清除" })).toBeNull();
	});

	it("没有内容时不渲染清除钮，输入后出现", () => {
		render(<Input aria-label={name} clearable />);
		expect(screen.queryByRole("button", { name: "清除" })).toBeNull();
		fireEvent.change(screen.getByRole("textbox", { name }), { target: { value: "a" } });
		expect(screen.getByRole("button", { name: "清除" })).toBeTruthy();
	});

	it("消费方拒绝清除时受控 DOM 值和清除按钮保持原值", () => {
		const change = vi.fn((event) => event.currentTarget.value);
		render(<Input aria-label={name} value="保留" clearable onChange={change} />);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		fireEvent.click(screen.getByRole("button", { name: "清除" }));
		expect(change).toHaveBeenCalledOnce();
		expect(change.mock.results[0]?.value).toBe("");
		expect(input.value).toBe("保留");
		expect(screen.getByRole("button", { name: "清除" })).toBeTruthy();
		expect(document.activeElement).toBe(input);
	});

	it("消费方接受清除后更新同一个 input 的受控值", () => {
		function ControlledInput() {
			const [value, setValue] = useState("初值");
			return (
				<Input
					aria-label={name}
					value={value}
					onChange={(event) => setValue(event.currentTarget.value)}
					clearable
				/>
			);
		}
		render(<ControlledInput />);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		fireEvent.click(screen.getByRole("button", { name: "清除" }));
		expect(input.value).toBe("");
		expect(document.activeElement).toBe(input);
		expect(screen.getByRole("textbox", { name })).toBe(input);
	});

	it("Esc 在有内容时清空并取消默认行为，已空时不拦截", () => {
		const clear = vi.fn();
		render(<Input aria-label={name} defaultValue="内容" clearable onClear={clear} />);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
		expect(input.value).toBe("");
		expect(clear).toHaveBeenCalledOnce();
		expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
		expect(clear).toHaveBeenCalledOnce();
	});

	it("Esc 只在 clearable 且可编辑时清空，调用方 preventDefault 优先", () => {
		const { rerender } = render(<Input aria-label={name} defaultValue="内容" />);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
		expect(input.value).toBe("内容");
		rerender(<Input aria-label={name} defaultValue="内容" clearable readOnly />);
		expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
		expect(input.value).toBe("内容");
		rerender(
			<Input
				aria-label={name}
				defaultValue="内容"
				clearable
				onKeyDown={(event) => event.preventDefault()}
			/>,
		);
		fireEvent.keyDown(input, { key: "Escape" });
		expect(input.value).toBe("内容");
	});

	it.each(["", "初值"])("reset 恢复非受控初值 %s 及清除可用状态", async (defaultValue) => {
		const { container } = render(
			<form>
				<Input aria-label={name} name="name" defaultValue={defaultValue} clearable />
			</form>,
		);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		const form = container.querySelector("form");
		if (!form) throw new Error("Missing form");
		fireEvent.change(input, { target: { value: defaultValue ? "" : "编辑值" } });
		await act(async () => form.reset());
		expect(input.value).toBe(defaultValue);
		expect(new FormData(form).get("name")).toBe(defaultValue);
		expect(Boolean(screen.queryByRole("button", { name: "清除" }))).toBe(Boolean(defaultValue));
	});

	it("取消 reset 保留值和清除操作，不生成 onChange", async () => {
		const change = vi.fn();
		const { container } = render(
			<form onReset={(event) => event.preventDefault()}>
				<Input aria-label={name} defaultValue="" clearable onChange={change} />
			</form>,
		);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		const form = container.querySelector("form");
		if (!form) throw new Error("Missing form");
		fireEvent.change(input, { target: { value: "保留" } });
		change.mockClear();
		await act(async () => form.reset());
		expect(input.value).toBe("保留");
		expect(screen.getByRole("button", { name: "清除" })).toBeTruthy();
		expect(change).not.toHaveBeenCalled();
	});

	it("外部 form 及动态表单归属的 reset 只同步当前所属字段", async () => {
		const field = (form: string) => (
			<Input aria-label={name} form={form} defaultValue="" clearable />
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
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
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
		expect(screen.getByRole("button", { name: "清除" })).toBeTruthy();
		await act(async () => second.reset());
		expect(input.value).toBe("");
		expect(screen.queryByRole("button", { name: "清除" })).toBeNull();
	});

	it.each(["detached", "shadow"])("%s 作用域 reset 同步非受控清除操作", async (scope) => {
		const host = document.createElement("div");
		const container = document.createElement("div");
		if (scope === "shadow") host.attachShadow({ mode: "open" }).append(container);
		const view = render(
			<form>
				<Input aria-label={name} defaultValue="" clearable />
			</form>,
			{ container },
		);
		try {
			const input = view.getByRole("textbox", { name });
			if (!(input instanceof HTMLInputElement)) throw new Error("Missing input");
			const form = container.querySelector("form");
			if (!form) throw new Error("Missing form");
			fireEvent.change(input, { target: { value: "编辑值" } });
			await act(async () => form.reset());
			expect(input.value).toBe("");
			expect(view.queryByRole("button", { name: "清除" })).toBeNull();
		} finally {
			view.unmount();
		}
	});
});

describe("Input 密码显隐", () => {
	it("disabled 与 readOnly 不提供清除，显隐钮禁用", () => {
		for (const state of ["disabled", "readOnly"] as const) {
			const { unmount } = render(
				<Input
					aria-label={name}
					type="password"
					defaultValue="保留"
					clearable
					passwordToggle
					{...{ [state]: true }}
				/>,
			);
			expect(screen.queryByRole("button", { name: "清除" })).toBeNull();
			expect(
				screen.getByRole<HTMLButtonElement>("button", { name: "显示密码" }).disabled,
			).toBe(true);
			unmount();
		}
	});

	it("切换保留节点和值，名称固定为「显示密码」，按下状态与输入类型一致", () => {
		render(<Input aria-label="密码" type="password" defaultValue="secret" passwordToggle />);
		const input = screen.getByLabelText<HTMLInputElement>("密码");
		const toggle = screen.getByRole("button", { name: "显示密码" });
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(toggle);
		expect(input.type).toBe("text");
		expect(input.value).toBe("secret");
		expect(screen.getByRole("button", { name: "显示密码" })).toBe(toggle);
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		expect(document.activeElement).toBe(input);
		fireEvent.click(toggle);
		expect(input.type).toBe("password");
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		expect(screen.getByLabelText("密码")).toBe(input);
	});

	it("切换前后光标位置保持", () => {
		render(<Input aria-label="密码" type="password" defaultValue="secret123" passwordToggle />);
		const input = screen.getByLabelText<HTMLInputElement>("密码");
		input.focus();
		input.setSelectionRange(2, 5);
		fireEvent.click(screen.getByRole("button", { name: "显示密码" }));
		expect([input.type, input.selectionStart, input.selectionEnd]).toEqual(["text", 2, 5]);
		input.setSelectionRange(4, 4);
		fireEvent.click(screen.getByRole("button", { name: "显示密码" }));
		expect([input.type, input.selectionStart, input.selectionEnd]).toEqual(["password", 4, 4]);
		expect(document.activeElement).toBe(input);
	});

	it("passwordToggleLabel 覆盖默认名称", () => {
		render(
			<Input aria-label="密码" type="password" passwordToggle passwordToggleLabel="查看" />,
		);
		expect(screen.getByRole("button", { name: "查看" })).toBeTruthy();
	});

	it("非 password 类型不提供显隐钮", () => {
		render(<Input aria-label={name} passwordToggle />);
		expect(screen.queryByRole("button")).toBeNull();
	});
});

describe("Input 只读复制", () => {
	it("点击把当前值写入剪贴板，图标换成已复制 1500ms 后复原，onCopied 收到值", async () => {
		vi.useFakeTimers();
		const writeText = vi.fn(() => Promise.resolve());
		stubClipboard(writeText);
		const copy = vi.fn();
		render(
			<Input
				aria-label={name}
				readOnly
				copyable
				defaultValue="https://example.com"
				onCopied={copy}
			/>,
		);
		const button = screen.getByRole("button", { name: "复制" });
		expect(button.hasAttribute("data-copied")).toBe(false);
		await act(async () => {
			fireEvent.click(button);
		});
		expect(writeText).toHaveBeenCalledExactlyOnceWith("https://example.com");
		expect(copy).toHaveBeenCalledExactlyOnceWith("https://example.com");
		expect(button.hasAttribute("data-copied")).toBe(true);
		act(() => vi.advanceTimersByTime(1499));
		expect(button.hasAttribute("data-copied")).toBe(true);
		act(() => vi.advanceTimersByTime(1));
		expect(button.hasAttribute("data-copied")).toBe(false);
	});

	it("只读输入区仍可聚焦，复制名称可覆盖", () => {
		render(<Input aria-label={name} readOnly copyable copyLabel="复制链接" defaultValue="x" />);
		const input = screen.getByRole<HTMLInputElement>("textbox", { name });
		input.focus();
		expect(document.activeElement).toBe(input);
		expect(screen.getByRole("button", { name: "复制链接" })).toBeTruthy();
	});

	it("剪贴板写入被拒绝或不可用时静默失败，不触发 onCopied", async () => {
		const copy = vi.fn();
		const { unmount } = render(
			<Input aria-label={name} copyable defaultValue="x" onCopied={copy} />,
		);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "复制" }));
		});
		expect(copy).not.toHaveBeenCalled();
		unmount();
		stubClipboard(() => Promise.reject(new Error("denied")));
		render(<Input aria-label={name} copyable defaultValue="x" onCopied={copy} />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "复制" }));
		});
		expect(copy).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "复制" }).hasAttribute("data-copied")).toBe(
			false,
		);
	});

	it("禁用时复制钮不可点", () => {
		render(<Input aria-label={name} copyable disabled defaultValue="x" />);
		expect(screen.getByRole<HTMLButtonElement>("button", { name: "复制" }).disabled).toBe(true);
	});
});

describe("Input 状态", () => {
	it("invalid 写入 aria-invalid 并显示警示图标，valid 只有视觉没有 ARIA", () => {
		const { container, rerender } = render(<Input aria-label={name} invalid />);
		const input = screen.getByRole("textbox", { name });
		const shell = container.firstElementChild as HTMLElement;
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(shell.hasAttribute("data-invalid")).toBe(true);
		expect(shell.querySelector('[data-status="invalid"]')).toBeTruthy();
		rerender(<Input aria-label={name} valid />);
		expect(input.hasAttribute("aria-invalid")).toBe(false);
		expect(shell.hasAttribute("data-valid")).toBe(true);
		expect(shell.querySelector('[data-status="valid"]')).toBeTruthy();
	});

	it("状态位同一时刻只有一个：loading 优先于 invalid，invalid 优先于 valid", () => {
		const { container, rerender } = render(<Input aria-label={name} invalid valid />);
		const shell = container.firstElementChild as HTMLElement;
		expect(shell.querySelectorAll("[data-status]")).toHaveLength(1);
		expect(shell.querySelector('[data-status="invalid"]')).toBeTruthy();
		expect(shell.hasAttribute("data-valid")).toBe(false);
		rerender(<Input aria-label={name} invalid valid loading />);
		expect(shell.querySelectorAll("[data-status]")).toHaveLength(1);
		expect(shell.querySelector('[data-status="loading"] .v-spinner')).toBeTruthy();
	});

	it.each([
		"grammar",
		"spelling",
	] as const)("aria-invalid=%s 保留语义，显式 invalid 可覆盖", (ariaInvalid) => {
		const { container, rerender } = render(
			<Input aria-label={name} aria-invalid={ariaInvalid} />,
		);
		const input = screen.getByRole("textbox", { name });
		expect(input.getAttribute("aria-invalid")).toBe(ariaInvalid);
		expect(container.querySelector('[data-status="invalid"]')).toBeTruthy();
		rerender(<Input aria-label={name} aria-invalid={ariaInvalid} invalid={false} />);
		expect(input.getAttribute("aria-invalid")).toBe("false");
		expect(container.querySelector("[data-status]")).toBeNull();
	});

	it("loading 渲染 Spinner 并关联 aria-busy", () => {
		const { container, rerender } = render(<Input aria-label={name} loading />);
		const input = screen.getByRole("textbox", { name });
		expect(input.getAttribute("aria-busy")).toBe("true");
		expect(container.querySelector(".v-spinner")).toBeTruthy();
		rerender(<Input aria-label={name} loading={false} />);
		expect(input.getAttribute("aria-busy")).toBeNull();
		expect(container.querySelector(".v-spinner")).toBeNull();
	});

	it("槽按 前置、输入区、清除、状态、后置、操作钮 的顺序排列", () => {
		const { container } = render(
			<Input
				aria-label={name}
				type="password"
				defaultValue="x"
				leading="@"
				trailing=".rua.plus"
				clearable
				passwordToggle
				invalid
			/>,
		);
		const shell = container.firstElementChild as HTMLElement;
		const order = [...shell.children].map((child) =>
			child.matches("input")
				? "input"
				: (child.className
						.split(" ")
						.find((token) => token.startsWith("v-input-control__")) ?? ""),
		);
		expect(order).toEqual([
			"v-input-control__leading",
			"input",
			"v-input-control__action",
			"v-input-control__status",
			"v-input-control__trailing",
			"v-input-control__action",
		]);
	});

	it("前后置槽的纯文字被标记为文字，节点不被标记", () => {
		const { container } = render(
			<Input aria-label={name} leading="https://" trailing={<kbd>↵</kbd>} />,
		);
		expect(
			container.querySelector(".v-input-control__leading")?.hasAttribute("data-text"),
		).toBe(true);
		expect(
			container.querySelector(".v-input-control__trailing")?.hasAttribute("data-text"),
		).toBe(false);
	});

	it("disabled 与 readOnly 同步到外壳", () => {
		const { container, rerender } = render(<Input aria-label={name} disabled />);
		const shell = container.firstElementChild as HTMLElement;
		expect(shell.hasAttribute("data-disabled")).toBe(true);
		rerender(<Input aria-label={name} readOnly />);
		expect(shell.hasAttribute("data-readonly")).toBe(true);
		expect(shell.hasAttribute("data-disabled")).toBe(false);
	});
});

describe("Input 水合", () => {
	it("SSR 水合保留节点与关联 ID，后续事件可用", async () => {
		const change = vi.fn();
		const ui = (
			<>
				<Input aria-label="用户名" defaultValue="初值" clearable onChange={change} />
				<Input aria-label="邮箱" invalid />
				<Input aria-label="密码" type="password" passwordToggle />
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
		} finally {
			await act(async () => root?.unmount());
			container.remove();
		}
	});
});
