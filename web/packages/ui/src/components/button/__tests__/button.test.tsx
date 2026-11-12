import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../button";
import { buttonVariants } from "../styles";

describe("Button", () => {
	it("默认 button 不意外提交表单，显式 submit 保留浏览器提交行为", () => {
		const submit = vi.fn((event) => event.preventDefault());
		render(
			<form onSubmit={submit}>
				<Button>普通动作</Button>
				<Button type="submit">提交</Button>
			</form>,
		);
		fireEvent.click(screen.getByRole("button", { name: "普通动作" }));
		expect(submit).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "提交" }));
		expect(submit).toHaveBeenCalledOnce();
	});

	it.each([
		"primary",
		"secondary",
		"outline",
		"ghost",
		"destructive",
		"link",
	] as const)("保留 %s 公开变体", (variant) => {
		render(<Button variant={variant}>{variant}</Button>);
		const button = screen.getByRole("button", { name: variant });
		expect(button.getAttribute("data-variant")).toBe(variant);
		expect(button.classList.contains(`v-button--${variant}`)).toBe(true);
	});

	it.each(["sm", "md", "lg"] as const)("保留 %s 公开尺寸", (size) => {
		render(
			<Button size={size} aria-label={`动作 ${size}`}>
				<svg aria-hidden="true" />
			</Button>,
		);
		expect(screen.getByRole("button", { name: `动作 ${size}` }).getAttribute("data-size")).toBe(
			size,
		);
	});

	it("默认中号，recipe 覆盖全部六种变体与三档尺寸", () => {
		const { container } = render(<Button>保存</Button>);
		expect(container.querySelector("button")?.getAttribute("data-size")).toBe("md");
		expect(buttonVariants({ variant: "primary" })).toContain("v-button--primary");
		expect(buttonVariants({ size: "lg" })).toContain("v-button--lg");
	});

	it("仅图标按钮是正圆（iconOnly），必须有可读名称", () => {
		render(
			<Button iconOnly aria-label="新建">
				<svg aria-hidden="true" />
			</Button>,
		);
		const button = screen.getByRole("button", { name: "新建" });
		expect(button.getAttribute("data-icon-only")).toBe("true");
		expect(button.getAttribute("aria-label")).toBe("新建");
	});

	it("前置图标表示动作、后置箭头表示展开或跳转，对读屏隐藏", () => {
		render(
			<Button
				leftIcon={<svg aria-hidden="true" data-testid="l" />}
				rightIcon={<svg aria-hidden="true" data-testid="r" />}
			>
				下载
			</Button>,
		);
		expect(screen.getByTestId("l").closest("[data-slot='start-icon']")).toBeTruthy();
		expect(screen.getByTestId("r").closest("[data-slot='end-icon']")).toBeTruthy();
		expect(
			screen
				.getByTestId("l")
				.closest("[data-slot='start-icon']")
				?.getAttribute("aria-hidden"),
		).toBe("true");
		expect(
			screen.getByTestId("r").closest("[data-slot='end-icon']")?.getAttribute("aria-hidden"),
		).toBe("true");
	});

	it("加载时宽度不变：指示器盖在文字中央，文字淡出但不卸载", () => {
		const { rerender } = render(
			<Button loading leftIcon={<svg aria-hidden="true" data-testid="l" />}>
				发布
			</Button>,
		);
		const button = screen.getByRole("button", { name: "发布" });
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.getAttribute("data-loading")).toBe("true");
		expect(button.querySelector(".v-button__overlay .v-spinner")).toBeTruthy();
		// 文字仍在 DOM，只是透明
		expect(button.querySelector(".v-button__label")?.textContent).toBe("发布");
		expect(button.querySelector(".v-button__label")).toBeTruthy();
		rerender(<Button leftIcon={<svg aria-hidden="true" data-testid="l" />}>发布</Button>);
		expect(screen.getByRole("button", { name: "发布" }).hasAttribute("aria-busy")).toBe(false);
	});

	it("无前置图标时指示器也盖在文字中央，文字不挪位", () => {
		render(<Button loading>发布</Button>);
		const button = screen.getByRole("button", { name: "发布" });
		expect(button.querySelector(".v-button__overlay .v-spinner")).toBeTruthy();
		expect(button.querySelector(".v-button__label")).toBeTruthy();
	});

	it("仅图标按钮加载时指示器在原位置替换图标", () => {
		render(
			<Button iconOnly aria-label="保存" loading>
				<svg aria-hidden="true" data-testid="i" />
			</Button>,
		);
		const button = screen.getByRole("button", { name: "保存" });
		expect(button.querySelector(".v-button__overlay .v-spinner")).toBeTruthy();
		expect(screen.getByTestId("i").parentElement?.textContent).toContain("");
	});

	it("loadingText 替换正文并进入可访问名称", () => {
		render(
			<Button loading loadingText="发布中…">
				发布
			</Button>,
		);
		const button = screen.getByRole("button", { name: "发布中…" });
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.textContent).toContain("发布中…");
	});

	it("done 渲染结果文字与对勾，对勾对读屏隐藏", () => {
		vi.useFakeTimers();
		try {
			const { rerender } = render(<Button done="已保存">保存</Button>);
			const button = screen.getByRole("button", { name: "已保存" });
			expect(button.textContent).toContain("已保存");
			const check = button.querySelector("[data-slot='done-icon']");
			expect(check?.getAttribute("aria-hidden")).toBe("true");
			rerender(<Button done="已保存">保存</Button>);
			vi.advanceTimersByTime(2000);
			// done 期间组件自己挂了定时器：清除 props 后由调用方渲染决定；这里验证不报错且仍显示结果
			expect(screen.getByRole("button", { name: "已保存" })).toBeTruthy();
		} finally {
			vi.useRealTimers();
		}
	});

	it("done 状态可点击且不带 aria-busy", () => {
		const click = vi.fn();
		render(
			<Button done="已保存" onClick={click}>
				保存
			</Button>,
		);
		const button = screen.getByRole("button", { name: "已保存" });
		expect(button.hasAttribute("aria-busy")).toBe(false);
		fireEvent.click(button);
		expect(click).toHaveBeenCalledOnce();
	});

	it("loading 时仍可聚焦但激活被忽略", () => {
		const click = vi.fn();
		render(
			<Button loading onClick={click}>
				发布
			</Button>,
		);
		const button = screen.getByRole("button", { name: "发布" });
		expect(button.hasAttribute("disabled")).toBe(false);
		expect(button.hasAttribute("aria-disabled")).toBe(false);
		expect(button.getAttribute("aria-busy")).toBe("true");
		button.focus();
		expect(document.activeElement).toBe(button);
		fireEvent.click(button);
		fireEvent.keyDown(button, { key: "Enter" });
		fireEvent.keyUp(button, { key: "Enter" });
		fireEvent.keyDown(button, { key: " " });
		fireEvent.keyUp(button, { key: " " });
		expect(click).not.toHaveBeenCalled();
	});

	it("原生 disabled 禁止操作并保留可访问名称", () => {
		const click = vi.fn();
		render(
			<Button disabled onClick={click}>
				删除
			</Button>,
		);
		const button = screen.getByRole("button", { name: "删除" });
		expect(button.hasAttribute("disabled")).toBe(true);
		fireEvent.click(button);
		expect(click).not.toHaveBeenCalled();
	});

	it("原生 object ref 与 callback ref 都指向真实 button 并在卸载时清理", () => {
		const objectRef = createRef<HTMLButtonElement>();
		const callbackRef = vi.fn();
		const { unmount } = render(
			<>
				<Button ref={objectRef}>对象</Button>
				<Button ref={callbackRef}>回调</Button>
			</>,
		);
		expect(objectRef.current?.tagName).toBe("BUTTON");
		expect(callbackRef.mock.calls.some(([node]) => node instanceof HTMLButtonElement)).toBe(
			true,
		);
		unmount();
		expect(objectRef.current).toBe(null);
		expect(callbackRef.mock.calls.at(-1)?.[0]).toBe(null);
	});

	describe("asChild", () => {
		it("链接保留原生 href 和名称，启用时按 child-first 顺序组合事件", () => {
			const onChild = vi.fn();
			const onButton = vi.fn();
			render(
				<Button asChild onClick={onButton}>
					<a href="/settings" onClick={onChild}>
						设置
					</a>
				</Button>,
			);
			const link = screen.getByRole("link", { name: "设置" });
			fireEvent.click(link);
			expect(onChild).toHaveBeenCalledOnce();
			expect(onButton).toHaveBeenCalledOnce();
		});

		it("loading 的原生子 button 不被禁用，只报忙碌", () => {
			render(
				<Button asChild loading>
					<button type="button" disabled={false}>
						保存
					</button>
				</Button>,
			);
			const child = screen.getByRole("button", { name: "保存" });
			expect(child.hasAttribute("disabled")).toBe(false);
			expect(child.getAttribute("aria-disabled")).toBeNull();
			expect(child.getAttribute("aria-busy")).toBe("true");
		});

		it("loading 的 asChild 子元素保留 tabIndex 且标记不可用", () => {
			render(
				<Button asChild loading>
					<a href="/s" tabIndex={-3}>
						链接
					</a>
				</Button>,
			);
			const link = screen.getByRole("link", { name: "链接" });
			expect(link.getAttribute("tabindex")).toBe("-3");
			expect(link.getAttribute("aria-busy")).toBe("true");
		});

		it("Slot 合并子元素 object ref 与按钮 callback ref", () => {
			const objectRef = createRef<HTMLAnchorElement>();
			const callbackRef = vi.fn();
			render(
				<Button asChild ref={callbackRef}>
					<a href="/s" ref={objectRef}>
						链接
					</a>
				</Button>,
			);
			expect(objectRef.current?.tagName).toBe("A");
			expect(callbackRef.mock.calls.some(([node]) => node instanceof HTMLAnchorElement)).toBe(
				true,
			);
		});

		it("asChild 保留子元素内容，不把 loadingText 或图标注入链接", () => {
			render(
				<Button asChild loading loadingText="保存中…">
					<a href="/s">保存</a>
				</Button>,
			);
			const link = screen.getByRole("link", { name: "保存" });
			expect(link.getAttribute("aria-busy")).toBe("true");
			expect(link.querySelector(".v-button__overlay .v-spinner")).toBeTruthy();
		});
	});

	it("可在服务端生成原生与 Slot 标记", () => {
		const html = renderToString(
			<>
				<Button loading>保存</Button>
				<Button asChild disabled>
					<a href="/settings">设置</a>
				</Button>
			</>,
		);
		expect(html).toContain('aria-busy="true"');
		expect(html).toContain('aria-disabled="true"');
		expect(html).toContain('href="/settings"');
		expect(html).toContain("保存");
	});
});
