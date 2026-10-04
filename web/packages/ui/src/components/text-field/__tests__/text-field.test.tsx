import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TextField } from "../text-field";

describe("TextField", () => {
	it("重复实例生成唯一且稳定的 input 与说明关联 ID", () => {
		const { rerender } = render(
			<>
				<TextField label="用户名" description="用于登录" />
				<TextField label="邮箱" description="用于通知" />
			</>,
		);
		const username = screen.getByRole("textbox", { name: "用户名" }) as HTMLInputElement;
		const email = screen.getByRole("textbox", { name: "邮箱" }) as HTMLInputElement;
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
				<TextField label="用户名" description="用于登录" defaultValue="新的默认值" />
				<TextField label="邮箱" description="用于通知" />
			</>,
		);
		expect(screen.getByRole("textbox", { name: "用户名" }).id).toBe(usernameId);
	});

	it("保留宿主 ID 并去重描述，只引用实际存在的内部节点", () => {
		const { rerender } = render(
			<>
				<p id="external-note">宿主说明</p>
				<TextField
					id="email"
					label="邮箱"
					description="联系邮箱"
					errorMessage="格式不正确"
					invalid
					aria-describedby="external-note external-note email-description email-error"
				/>
			</>,
		);
		const input = screen.getByRole("textbox", { name: "邮箱" });
		expect(input.id).toBe("email");
		expect(input.getAttribute("aria-describedby")).toBe(
			"external-note email-description email-error",
		);
		expect(input.getAttribute("aria-invalid")).toBe("true");
		rerender(
			<>
				<p id="external-note">宿主说明</p>
				<TextField
					id="email"
					label="邮箱"
					errorMessage="格式不正确"
					invalid={false}
					aria-describedby="external-note external-note"
				/>
			</>,
		);
		expect(input.getAttribute("aria-describedby")).toBe("external-note");
		expect(input.getAttribute("aria-invalid")).toBe("false");
		expect(document.getElementById("email-description")).toBeNull();
		expect(document.getElementById("email-error")).toBeNull();
	});

	it("保留宿主提供的说明 ID，即使其名称与内部 ID 格式一致", () => {
		render(
			<>
				<p id="email-description">宿主说明</p>
				<p id="email-error">宿主错误提示</p>
				<TextField
					id="email"
					label="邮箱"
					aria-describedby="email-description email-error email-description"
				/>
			</>,
		);
		const input = screen.getByRole("textbox", { name: "邮箱" });
		expect(input.getAttribute("aria-describedby")).toBe("email-description email-error");
		expect(
			input
				.getAttribute("aria-describedby")
				?.split(" ")
				.map((id) => document.getElementById(id)?.textContent),
		).toEqual(["宿主说明", "宿主错误提示"]);
	});

	it("说明与错误省略时不生成悬空 aria-describedby", () => {
		render(<TextField label="标题" errorMessage="尚未出错" description={false} />);
		const input = screen.getByRole("textbox", { name: "标题" });
		expect(input.hasAttribute("aria-describedby")).toBe(false);
		expect(input.hasAttribute("aria-invalid")).toBe(false);
		expect(screen.queryByText("尚未出错")).toBeNull();
	});

	it.each([
		"grammar",
		"spelling",
	] as const)("原生 aria-invalid=%s 保留语义，仍关联错误文案", (ariaInvalid) => {
		render(<TextField label="标题" aria-invalid={ariaInvalid} errorMessage="请检查文字" />);
		const input = screen.getByRole("textbox", { name: "标题" });
		expect(input.getAttribute("aria-invalid")).toBe(ariaInvalid);
		expect(
			document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent,
		).toBe("请检查文字");
	});

	it("invalid 显式值优先于原生 aria-invalid", () => {
		render(<TextField label="标题" invalid={false} aria-invalid="true" errorMessage="错误" />);
		expect(screen.getByRole("textbox", { name: "标题" }).getAttribute("aria-invalid")).toBe(
			"false",
		);
		expect(screen.queryByText("错误")).toBeNull();
	});

	it("label、description、error 支持 ReactNode，包括数字 0", () => {
		render(
			<TextField
				label={<strong>标题</strong>}
				description={0}
				invalid
				errorMessage={<strong>请输入标题</strong>}
			/>,
		);
		const input = screen.getByRole("textbox", { name: "标题" });
		const descriptionIds = input.getAttribute("aria-describedby")?.split(" ") ?? [];
		expect(descriptionIds.map((id) => document.getElementById(id)?.textContent)).toEqual([
			"0",
			"请输入标题",
		]);
	});

	it("className 仅传给 input，classNames 各槽分别生效", () => {
		const { container } = render(
			<TextField
				label="标题"
				description="说明"
				invalid
				errorMessage="错误"
				className="font-mono"
				classNames={{
					root: "root-layout",
					label: "label-style",
					input: "input-style",
					description: "description-style",
					error: "error-style",
				}}
			/>,
		);
		const input = screen.getByRole("textbox", { name: "标题" });
		expect(input.classList.contains("font-mono")).toBe(true);
		expect(input.classList.contains("input-style")).toBe(true);
		const root = container.firstElementChild;
		expect(root?.classList.contains("root-layout")).toBe(true);
		expect(root?.classList.contains("font-mono")).toBe(false);
		expect(screen.getByText("标题").classList.contains("label-style")).toBe(true);
		expect(screen.getByText("说明").classList.contains("description-style")).toBe(true);
		expect(screen.getByText("错误").classList.contains("error-style")).toBe(true);
	});

	it("object 与 callback ref 指向 input，聚焦和清理仍可由消费方控制", () => {
		const objectRef = createRef<HTMLInputElement>();
		const callbackRef = vi.fn();
		const { unmount } = render(
			<>
				<TextField ref={objectRef} label="姓名" />
				<TextField ref={callbackRef} label="邮箱" />
			</>,
		);
		expect(objectRef.current).toBe(screen.getByRole("textbox", { name: "姓名" }));
		expect(callbackRef).toHaveBeenCalledWith(screen.getByRole("textbox", { name: "邮箱" }));
		objectRef.current?.focus();
		expect(document.activeElement).toBe(objectRef.current);
		unmount();
		expect(objectRef.current).toBeNull();
		expect(callbackRef.mock.calls.at(-1)?.[0]).toBeNull();
	});

	it("保留原生 FormData、reset 与禁用字段排除语义", () => {
		const { container } = render(
			<form>
				<TextField label="姓名" name="name" defaultValue="初值" required />
				<TextField label="内部字段" name="internal" defaultValue="排除" disabled />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		const input = screen.getByRole("textbox", { name: "姓名" }) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "编辑值" } });
		expect(new FormData(form).get("name")).toBe("编辑值");
		expect(new FormData(form).has("internal")).toBe(false);
		expect(input.required).toBe(true);
		form.reset();
		expect(input.value).toBe("初值");
	});

	it("受控 value 与 onChange 由消费方管理", () => {
		function ControlledField() {
			const [value, setValue] = useState("初值");
			return (
				<TextField
					label="姓名"
					value={value}
					onChange={(event) => setValue(event.currentTarget.value)}
				/>
			);
		}
		render(<ControlledField />);
		const input = screen.getByRole("textbox", { name: "姓名" }) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "新值" } });
		expect(input.value).toBe("新值");
	});

	it("SSR 水合保留 input 节点和所有关联 ID，事件在水合后正常工作", async () => {
		const change = vi.fn();
		const ui = (
			<>
				<TextField
					label={<strong>用户名</strong>}
					description={<span>用于登录</span>}
					defaultValue="初值"
					onChange={change}
				/>
				<TextField label="邮箱" invalid errorMessage="请输入邮箱" />
			</>
		);
		const container = document.createElement("div");
		container.innerHTML = renderToString(ui);
		document.body.append(container);
		const serverInput = container.querySelector("input");
		const serverIds = [...container.querySelectorAll("[id]")].map((element) => element.id);
		const recoverableError = vi.fn();
		let root: Root | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(container, ui, { onRecoverableError: recoverableError });
			});
			expect(container.querySelector("input")).toBe(serverInput);
			expect([...container.querySelectorAll("[id]")].map((element) => element.id)).toEqual(
				serverIds,
			);
			expect(recoverableError).not.toHaveBeenCalled();
			const input = screen.getByRole("textbox", { name: "用户名" });
			fireEvent.change(input, { target: { value: "水合后输入" } });
			expect(change).toHaveBeenCalledOnce();
		} finally {
			await act(async () => root?.unmount());
			container.remove();
		}
	});
});
