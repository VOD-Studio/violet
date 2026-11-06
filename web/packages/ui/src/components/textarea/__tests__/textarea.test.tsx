import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Textarea } from "../textarea";

/** 与实现同步的多行行高；自动增高的 clamp 断言依赖它。 */
const LINE_HEIGHT = 24;

function stubScrollHeight(textarea: HTMLElement, height: number) {
	Object.defineProperty(textarea, "scrollHeight", {
		value: height,
		configurable: true,
	});
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Textarea 结构与原生语义", () => {
	it("外壳携带变体类，className、style、ref、id、name 都落在原生 textarea", () => {
		const ref = createRef<HTMLTextAreaElement>();
		const { container } = render(
			<Textarea
				ref={ref}
				id="bio"
				name="bio"
				style={{ minHeight: 40 }}
				variant="outline"
				aria-label="简介"
			/>,
		);
		const shell = container.firstElementChild as HTMLElement;
		expect(shell.className).toContain("v-input-control v-textarea");
		expect(shell.className).toContain("v-input-control--outline");

		const textarea = screen.getByRole("textbox", { name: "简介" });
		expect(ref.current).toBe(textarea);
		expect(textarea.id).toBe("bio");
		expect(textarea.getAttribute("name")).toBe("bio");
		expect(textarea.style.minHeight).toBe("40px");
		expect(shell.style.minHeight).toBe("");
	});

	it("四种变体分别映射到输入框外壳的变体类", () => {
		const cases = [
			["filled", "v-input-control--filled"],
			["outline", "v-input-control--outline"],
			["underline", "v-input-control--underline"],
			["plain", "v-input-control--plain"],
		] as const;
		for (const [variant, cls] of cases) {
			const { container, unmount } = render(<Textarea variant={variant} aria-label="正文" />);
			expect((container.firstElementChild as HTMLElement).className).toContain(cls);
			unmount();
		}
	});

	it("受控值由消费方更新，name 参与表单提交", () => {
		function Host() {
			const [value, setValue] = useState("第一行\n第二行");
			return (
				<form>
					<Textarea
						aria-label="正文"
						name="body"
						rows={8}
						value={value}
						onChange={(event) => setValue(event.currentTarget.value)}
					/>
				</form>
			);
		}
		const { container } = render(<Host />);
		const textarea = screen.getByRole("textbox", { name: "正文" }) as HTMLTextAreaElement;
		expect(textarea.rows).toBe(8);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(new FormData(form).get("body")).toBe("第一行\n第二行");
		fireEvent.change(textarea, { target: { value: "改" } });
		expect(textarea.value).toBe("改");
	});

	it("autoSize 时输入直接驱动高度，不依赖消费方重渲染", () => {
		const { container } = render(<Textarea aria-label="正文" autoSize />);
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		stubScrollHeight(textarea, 5 * LINE_HEIGHT);
		act(() => {
			fireEvent.input(textarea, { target: { value: "一行内容" } });
		});
		// scrollHeight 120px 在 3–8 行范围内，直接采用
		expect(textarea.style.height).toBe(`${5 * LINE_HEIGHT}px`);
	});

	it("点外壳空白处聚焦输入区，点击操作栏按钮不劫持", () => {
		const { container } = render(
			<Textarea aria-label="正文" toolbar={<button type="button">发送</button>} />,
		);
		const textarea = screen.getByRole("textbox", { name: "正文" });
		const shell = container.firstElementChild as HTMLElement;
		expect(fireEvent.mouseDown(shell)).toBe(false);
		expect(document.activeElement).toBe(textarea);
		expect(fireEvent.mouseDown(screen.getByRole("button", { name: "发送" }))).toBe(true);
	});
});

describe("Textarea 自动增高", () => {
	it("默认在 3–8 行之间clamp：内容矮于 3 行补足 3 行，高于 8 行内部滚动", () => {
		const { container, rerender } = render(<Textarea aria-label="正文" autoSize />);
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

		stubScrollHeight(textarea, LINE_HEIGHT);
		rerender(<Textarea aria-label="正文" autoSize value="一行" onChange={() => { }} />);
		expect(textarea.style.height).toBe(`${3 * LINE_HEIGHT}px`);

		stubScrollHeight(textarea, 20 * LINE_HEIGHT);
		rerender(<Textarea aria-label="正文" autoSize value="很长" onChange={() => { }} />);
		expect(textarea.style.height).toBe(`${8 * LINE_HEIGHT}px`);
	});

	it("minRows / maxRows 可调，固定行数形态不写高度", () => {
		const { container, rerender } = render(
			<Textarea aria-label="正文" autoSize={{ minRows: 2, maxRows: 4 }} />,
		);
		let textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		stubScrollHeight(textarea, 9 * LINE_HEIGHT);
		rerender(
			<Textarea
				aria-label="正文"
				autoSize={{ minRows: 2, maxRows: 4 }}
				value="很多"
				onChange={() => { }}
			/>,
		);
		expect(textarea.style.height).toBe(`${4 * LINE_HEIGHT}px`);

		const plain = render(<Textarea aria-label="固定" rows={4} />).container;
		textarea = plain.querySelector("textarea") as HTMLTextAreaElement;
		expect(textarea.style.height).toBe("");
		expect(textarea.rows).toBe(4);
	});
});

describe("Textarea 字数", () => {
	it("showCount 需要 maxLength，渲染 n / max，达到上限 90% 变危险色", () => {
		function Host() {
			const [value, setValue] = useState("一句话");
			return (
				<Textarea
					aria-label="简介"
					showCount
					maxLength={60}
					value={value}
					onChange={(event) => setValue(event.currentTarget.value)}
				/>
			);
		}
		const { container } = render(<Host />);
		expect(screen.getByText("3 / 60")).toBeTruthy();
		expect(container.querySelector("[data-over]")).toBeNull();

		fireEvent.change(screen.getByRole("textbox", { name: "简介" }), {
			target: { value: "九".repeat(54) },
		});
		const count = container.querySelector(".v-textarea__count");
		const live = container.querySelector('[aria-live="polite"]');
		expect(count?.textContent).toBe("54 / 60");
		expect(count?.hasAttribute("data-over")).toBe(true);
		expect(live?.textContent).toBe("54 / 60");
	});

	it("读稿只在接近上限时开始：90% 之前 live region 为空", () => {
		render(<Textarea aria-label="简介" showCount maxLength={60} onChange={() => { }} />);
		const live = document.querySelector('[aria-live="polite"]') as HTMLElement;
		expect(live.textContent).toBe("");

		fireEvent.change(screen.getByRole("textbox", { name: "简介" }), {
			target: { value: "近".repeat(54) },
		});
		expect(live.textContent).toContain("54");
	});

	it("没有 maxLength 时 showCount 不渲染字数", () => {
		render(<Textarea aria-label="简介" showCount />);
		expect(document.querySelector('[aria-live="polite"]')).toBeNull();
		expect(screen.queryByText(/\/ /)).toBeNull();
	});
});

describe("Textarea 操作栏与状态", () => {
	it("toolbar 渲染进外壳底部的操作栏，字数排到栏右端", () => {
		const { container } = render(
			<Textarea
				aria-label="评论"
				showCount
				maxLength={500}
				toolbar={<button type="button">插入图片</button>}
				onChange={() => { }}
			/>,
		);
		const bar = container.querySelector(".v-textarea__bar") as HTMLElement;
		expect(bar.querySelector("button")?.textContent).toBe("插入图片");
		expect(bar.querySelector(".v-textarea__count")).not.toBeNull();
		// 字数进了操作栏后，外壳不再另有一份
		const shell = container.firstElementChild as HTMLElement;
		expect(shell.querySelectorAll(".v-textarea__count")).toHaveLength(1);
	});

	it("invalid 显式值优先并写入 aria-invalid，外壳标记出错", () => {
		const { container, rerender } = render(
			<Textarea aria-label="正文" aria-invalid="false" invalid />,
		);
		let textarea = screen.getByRole("textbox", { name: "正文" });
		expect(textarea.getAttribute("aria-invalid")).toBe("true");
		expect((container.firstElementChild as HTMLElement).hasAttribute("data-invalid")).toBe(
			true,
		);

		rerender(<Textarea aria-label="正文" aria-invalid="true" />);
		textarea = screen.getByRole("textbox", { name: "正文" });
		expect(textarea.getAttribute("aria-invalid")).toBe("true");

		rerender(<Textarea aria-label="正文" />);
		expect(
			screen.getByRole("textbox", { name: "正文" }).getAttribute("aria-invalid"),
		).toBeNull();
		expect((container.firstElementChild as HTMLElement).hasAttribute("data-invalid")).toBe(
			false,
		);
	});

	it("disabled 与 readOnly 标在外壳上，属性保留原生语义", () => {
		const { container } = render(<Textarea aria-label="正文" disabled readOnly />);
		const shell = container.firstElementChild as HTMLElement;
		expect(shell.hasAttribute("data-disabled")).toBe(true);
		expect(shell.hasAttribute("data-readonly")).toBe(true);
		expect(screen.getByRole("textbox", { name: "正文" })).toHaveProperty("disabled", true);
	});

	it("classNames 各槽落位：control 在外壳，input 在输入区", () => {
		const { container } = render(
			<Textarea
				aria-label="正文"
				classNames={{ control: "extra-control", input: "extra-input" }}
			/>,
		);
		expect((container.firstElementChild as HTMLElement).className).toContain("extra-control");
		expect((container.querySelector("textarea") as HTMLTextAreaElement).className).toContain(
			"extra-input",
		);
	});
});

describe("Textarea 水合", () => {
	it("SSR 水合保留节点与关联 ID，后续事件可用", async () => {
		const ui = <Textarea aria-label="正文" showCount maxLength={60} defaultValue="初值" />;
		const container = document.createElement("div");
		container.innerHTML = renderToString(ui);
		document.body.append(container);
		const serverTextarea = container.querySelector("textarea");
		const serverIds = [...container.querySelectorAll("[id]")].map((element) => element.id);
		const recoverableError = vi.fn();
		let root: Root | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(container, ui, { onRecoverableError: recoverableError });
			});
			expect(container.querySelector("textarea")).toBe(serverTextarea);
			expect([...container.querySelectorAll("[id]")].map((element) => element.id)).toEqual(
				serverIds,
			);
			expect(recoverableError).not.toHaveBeenCalled();
			fireEvent.change(screen.getByRole("textbox", { name: "正文" }), {
				target: { value: "近".repeat(54) },
			});
			expect(container.querySelector(".v-textarea__count")?.textContent).toBe("54 / 60");
		} finally {
			root?.unmount();
			container.remove();
		}
	});
});
