import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Tag, TagToggle } from "../tag";

describe("Tag", () => {
	it("渲染文字、保留原生 span 属性与 ref", () => {
		const ref = createRef<HTMLSpanElement>();
		render(
			<Tag ref={ref} id="t" data-testid="tag">
				#shell
			</Tag>,
		);
		const tag = screen.getByTestId("tag");
		expect(tag.tagName).toBe("SPAN");
		expect(tag.id).toBe("t");
		expect(tag.textContent).toBe("#shell");
		expect(ref.current).toBe(tag);
	});

	it("没有 onRemove 时没有按钮", () => {
		render(<Tag>#shell</Tag>);
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("图标在文字前，对读屏隐藏，名称只剩文字", () => {
		render(
			<Tag icon={<svg data-testid="icon" />} data-testid="tag">
				精选
			</Tag>,
		);
		const icon = screen.getByTestId("icon");
		expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
		const tag = screen.getByTestId("tag");
		expect(tag.firstElementChild?.contains(icon)).toBe(true);
		expect(tag.textContent).toBe("精选");
	});

	describe("可移除", () => {
		it("× 是独立按钮，默认名称为「移除 文字」", () => {
			render(<Tag onRemove={() => {}}>shell</Tag>);
			expect(screen.getByRole("button", { name: "移除 shell" })).toBeTruthy();
		});

		it("JSX 把文字拆成多段（如 #{name}）时，名称仍带上完整文字", () => {
			const name = "shell";
			render(<Tag onRemove={() => {}}>#{name}</Tag>);
			expect(screen.getByRole("button", { name: "移除 #shell" })).toBeTruthy();
		});

		it("removeLabel 覆盖默认名称；非文字内容没有默认文字时仍可读", () => {
			const { rerender } = render(
				<Tag onRemove={() => {}} removeLabel="删除标签 shell">
					shell
				</Tag>,
			);
			expect(screen.getByRole("button", { name: "删除标签 shell" })).toBeTruthy();
			rerender(
				<Tag onRemove={() => {}}>
					<b>shell</b>
				</Tag>,
			);
			expect(screen.getByRole("button", { name: "移除" })).toBeTruthy();
		});

		it("点击 × 只调用一次 onRemove，且不冒泡到父级", () => {
			const remove = vi.fn();
			const parentClick = vi.fn();
			render(
				// biome-ignore lint/a11y/useKeyWithClickEvents: 只为观察冒泡
				<div onClick={parentClick}>
					<Tag onRemove={remove}>shell</Tag>
				</div>,
			);
			fireEvent.click(screen.getByRole("button", { name: "移除 shell" }));
			expect(remove).toHaveBeenCalledOnce();
			expect(parentClick).not.toHaveBeenCalled();
		});

		it("点击 × 不提交所在表单", () => {
			const submit = vi.fn((event) => event.preventDefault());
			render(
				<form onSubmit={submit}>
					<Tag onRemove={() => {}}>shell</Tag>
				</form>,
			);
			fireEvent.click(screen.getByRole("button", { name: "移除 shell" }));
			expect(submit).not.toHaveBeenCalled();
		});

		it("× 键盘焦点可达，Enter/Space 不被拦截而交给原生 button 激活", () => {
			render(<Tag onRemove={() => {}}>shell</Tag>);
			const remove = screen.getByRole("button", { name: "移除 shell" });
			remove.focus();
			expect(document.activeElement).toBe(remove);
			for (const key of ["Enter", " "]) {
				expect(fireEvent.keyDown(remove, { key })).toBe(true);
				expect(fireEvent.keyUp(remove, { key })).toBe(true);
			}
		});

		it("点击 tag 本身不触发移除", () => {
			const remove = vi.fn();
			render(
				<Tag onRemove={remove} data-testid="tag">
					shell
				</Tag>,
			);
			fireEvent.click(screen.getByTestId("tag"));
			expect(remove).not.toHaveBeenCalled();
		});
	});

	describe("asChild", () => {
		it("链接标签保留 a 的 href 与 ref", () => {
			const ref = createRef<HTMLAnchorElement>();
			render(
				<Tag asChild>
					<a href="/tags/shell" ref={ref}>
						#shell
					</a>
				</Tag>,
			);
			const link = screen.getByRole("link", { name: "#shell" });
			expect(link.getAttribute("href")).toBe("/tags/shell");
			expect(ref.current).toBe(link);
		});

		it("链接点击仍由子元素处理", () => {
			const click = vi.fn((event) => event.preventDefault());
			render(
				<Tag asChild>
					<a href="/tags/shell" onClick={click}>
						#shell
					</a>
				</Tag>,
			);
			fireEvent.click(screen.getByRole("link", { name: "#shell" }));
			expect(click).toHaveBeenCalledOnce();
		});
	});
});

describe("TagToggle", () => {
	it("原生 button，带 aria-pressed，不提交表单", () => {
		const submit = vi.fn((event) => event.preventDefault());
		render(
			<form onSubmit={submit}>
				<TagToggle>前端</TagToggle>
			</form>,
		);
		const toggle = screen.getByRole("button", { name: "前端" });
		expect(toggle.getAttribute("type")).toBe("button");
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(toggle);
		expect(submit).not.toHaveBeenCalled();
	});

	it("非受控：defaultPressed 初值，点击切换并通知", () => {
		const change = vi.fn();
		render(
			<TagToggle defaultPressed onPressedChange={change}>
				前端
			</TagToggle>,
		);
		const toggle = screen.getByRole("button", { name: "前端" });
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		expect(change).toHaveBeenLastCalledWith(false);
	});

	it("受控：状态由 pressed 决定，点击只请求变更", () => {
		const change = vi.fn();
		const { rerender } = render(
			<TagToggle pressed={false} onPressedChange={change}>
				前端
			</TagToggle>,
		);
		const toggle = screen.getByRole("button", { name: "前端" });
		fireEvent.click(toggle);
		expect(change).toHaveBeenCalledWith(true);
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		rerender(
			<TagToggle pressed onPressedChange={change}>
				前端
			</TagToggle>,
		);
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
	});

	it("互斥组由调用方用受控 pressed 组合", () => {
		function Filters() {
			const [active, setActive] = useState("全部");
			return (
				<div role="group" aria-label="按栏目筛选">
					{["全部", "前端", "后端"].map((name) => (
						<TagToggle
							key={name}
							pressed={active === name}
							onPressedChange={(next) => next && setActive(name)}
						>
							{name}
						</TagToggle>
					))}
				</div>
			);
		}
		render(<Filters />);
		const group = screen.getByRole("group", { name: "按栏目筛选" });
		fireEvent.click(screen.getByRole("button", { name: "前端" }));
		const pressed = [...group.querySelectorAll("button")]
			.filter((button) => button.getAttribute("aria-pressed") === "true")
			.map((button) => button.textContent);
		expect(pressed).toEqual(["前端"]);
	});

	it("disabled 时不可切换也不可聚焦激活", () => {
		const change = vi.fn();
		render(
			<TagToggle disabled onPressedChange={change}>
				前端
			</TagToggle>,
		);
		const toggle = screen.getByRole("button", { name: "前端" }) as HTMLButtonElement;
		expect(toggle.disabled).toBe(true);
		fireEvent.click(toggle);
		expect(change).not.toHaveBeenCalled();
	});

	it("键盘焦点可达，Enter/Space 不被拦截而交给原生 button 激活", () => {
		render(<TagToggle>前端</TagToggle>);
		const toggle = screen.getByRole("button", { name: "前端" });
		toggle.focus();
		expect(document.activeElement).toBe(toggle);
		for (const key of ["Enter", " "]) {
			expect(fireEvent.keyDown(toggle, { key })).toBe(true);
			expect(fireEvent.keyUp(toggle, { key })).toBe(true);
		}
	});

	it("图标对读屏隐藏，ref 指向 button", () => {
		const ref = createRef<HTMLButtonElement>();
		render(
			<TagToggle ref={ref} icon={<svg data-testid="icon" />}>
				精选
			</TagToggle>,
		);
		expect(screen.getByTestId("icon").closest('[aria-hidden="true"]')).not.toBeNull();
		expect(ref.current).toBe(screen.getByRole("button", { name: "精选" }));
	});
});
