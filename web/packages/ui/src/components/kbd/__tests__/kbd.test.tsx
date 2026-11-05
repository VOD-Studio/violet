import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Kbd, KbdSeparator } from "../kbd";

/** 一个键帽里的各单元格文字，按渲染顺序。 */
function cells(kbd: Element | null) {
	return [...(kbd?.querySelectorAll(".v-kbd__key") ?? [])].map((cell) => cell.textContent);
}

describe("Kbd 单键", () => {
	it("渲染原生 kbd 元素，内容为传入的单个键", () => {
		const { container } = render(<Kbd>Esc</Kbd>);
		const kbd = container.querySelector("kbd");
		expect(kbd).not.toBeNull();
		expect(kbd?.textContent).toBe("Esc");
	});

	it("透传原生属性与 ref 到 kbd", () => {
		const ref = createRef<HTMLElement>();
		render(
			<Kbd ref={ref} id="hint" title="退出" data-testid="cap" className="custom">
				/
			</Kbd>,
		);
		const kbd = screen.getByTestId("cap");
		expect(ref.current).toBe(kbd);
		expect(kbd.tagName).toBe("KBD");
		expect(kbd.id).toBe("hint");
		expect(kbd.getAttribute("title")).toBe("退出");
		expect(kbd.classList.contains("custom")).toBe(true);
	});
});

describe("Kbd 组合键", () => {
	it("一个组合是一个 kbd，修饰符在前，顺序固定为 ⌃ ⌥ ⇧ ⌘（macOS）", () => {
		const { container } = render(
			<Kbd platform="mac" keys={["mod", "shift", "alt", "ctrl", "K"]} />,
		);
		expect(container.querySelectorAll("kbd")).toHaveLength(1);
		expect(cells(container.querySelector("kbd"))).toEqual(["⌃", "⌥", "⇧", "⌘", "K"]);
		expect(container.textContent).not.toContain("+");
	});

	it("非 macOS 使用文字修饰符，mod 对应 Ctrl", () => {
		const { container } = render(<Kbd platform="other" keys={["mod", "shift", "alt", "K"]} />);
		expect(cells(container.querySelector("kbd"))).toEqual(["Ctrl", "Alt", "Shift", "K"]);
	});

	it("不论传入顺序，修饰符都排在主键之前", () => {
		const { container } = render(<Kbd platform="mac" keys={["K", "mod"]} />);
		expect(cells(container.querySelector("kbd"))).toEqual(["⌘", "K"]);
	});

	it("符号键带读屏名称，字母不加名称", () => {
		render(<Kbd platform="mac" keys={["mod", "shift", "enter", "K"]} />);
		expect(screen.getByLabelText("Command").textContent).toBe("⌘");
		expect(screen.getByLabelText("Shift").textContent).toBe("⇧");
		expect(screen.getByLabelText("Return").textContent).toBe("↵");
		expect(screen.getByText("K").getAttribute("aria-label")).toBeNull();
	});

	it("Esc 读作 Escape，方向键读作中文名称，文字修饰符不重复加名称", () => {
		render(
			<>
				<Kbd platform="other" keys={["ctrl", "up"]} />
				<Kbd platform="other" keys={["esc"]} data-testid="esc" />
			</>,
		);
		expect(screen.getByText("Ctrl").getAttribute("aria-label")).toBeNull();
		expect(screen.getByLabelText("上方向键").textContent).toBe("↑");
		expect(
			screen.getByTestId("esc").querySelector("[aria-label]")?.getAttribute("aria-label"),
		).toBe("Escape");
	});

	it("未登记的字符串原样作为主键", () => {
		const { container } = render(<Kbd platform="mac" keys={["F5"]} />);
		expect(cells(container.querySelector("kbd"))).toEqual(["F5"]);
	});
});

describe("KbdSeparator", () => {
	it("是带语义文字的普通元素，不对读屏隐藏", () => {
		render(<KbdSeparator>然后</KbdSeparator>);
		const separator = screen.getByText("然后");
		expect(separator.getAttribute("aria-hidden")).toBeNull();
	});
});

describe("Kbd 平台检测", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("服务端渲染输出文字修饰符，不读取客户端平台", () => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
		const html = renderToString(<Kbd keys={["mod", "K"]} />);
		expect(html).toContain("Ctrl");
		expect(html).not.toContain("⌘");
	});

	it("macOS 访客水合后切换为符号，且水合没有差异报错", async () => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
		const container = document.createElement("div");
		container.innerHTML = renderToString(<Kbd keys={["mod", "K"]} />);
		document.body.append(container);
		const recoverableError = vi.fn();
		let root: Root | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(container, <Kbd keys={["mod", "K"]} />, {
					onRecoverableError: recoverableError,
				});
			});
			expect(recoverableError).not.toHaveBeenCalled();
			expect(container.querySelector("kbd")?.textContent).toBe("⌘K");
		} finally {
			await act(async () => root?.unmount());
			container.remove();
		}
	});

	it("非 macOS 访客保持文字修饰符", async () => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
		render(<Kbd keys={["mod", "K"]} />);
		expect(screen.getByText("Ctrl")).not.toBeNull();
	});

	it("显式 platform 优先于检测结果", () => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
		render(<Kbd platform="other" keys={["mod", "K"]} />);
		expect(screen.getByText("Ctrl")).not.toBeNull();
		expect(screen.queryByLabelText("Command")).toBeNull();
	});
});
