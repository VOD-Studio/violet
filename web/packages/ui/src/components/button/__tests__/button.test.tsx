import { fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps, createRef, useState } from "react";
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
		"default",
		"primary",
		"secondary",
		"soft",
		"outline",
		"ghost",
		"link",
		"destructive",
	] as const)("保留 %s 公开变体", (variant) => {
		render(<Button variant={variant}>{variant}</Button>);
		const button = screen.getByRole("button", { name: variant });
		expect(button.getAttribute("data-variant")).toBe(variant);
		expect(button.classList.contains(`v-button--${variant}`)).toBe(true);
	});

	it.each([
		"default",
		"xs",
		"sm",
		"lg",
		"xl",
		"icon",
		"icon-xs",
		"icon-sm",
		"icon-lg",
	] as const)("保留 %s 公开尺寸", (size) => {
		render(
			<Button size={size} aria-label={`动作 ${size}`}>
				<svg aria-hidden="true" />
			</Button>,
		);
		expect(screen.getByRole("button", { name: `动作 ${size}` }).getAttribute("data-size")).toBe(
			size,
		);
	});

	it("原生 disabled 与 loading 都禁止操作，并保留可访问名称", () => {
		const click = vi.fn();
		const { rerender } = render(
			<Button disabled onClick={click}>
				保存
			</Button>,
		);
		const button = screen.getByRole("button", { name: "保存" }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		fireEvent.click(button);
		expect(click).not.toHaveBeenCalled();

		rerender(
			<Button loading onClick={click}>
				保存
			</Button>,
		);
		expect(button.disabled).toBe(true);
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.getAttribute("aria-disabled")).toBe("true");
		expect(screen.getByRole("button", { name: "保存" })).toBe(button);
		fireEvent.click(button);
		expect(click).not.toHaveBeenCalled();

		rerender(<Button onClick={click}>保存</Button>);
		expect(button.disabled).toBe(false);
		expect(button.hasAttribute("aria-busy")).toBe(false);
		fireEvent.click(button);
		expect(click).toHaveBeenCalledOnce();
	});

	it("loadingText 显式替换可访问名称，图标槽不引入额外名称", () => {
		render(
			<Button
				loading
				loadingText="正在保存"
				leftIcon={
					<svg>
						<title>邮件</title>
					</svg>
				}
				rightIcon={
					<svg>
						<title>箭头</title>
					</svg>
				}
			>
				保存
			</Button>,
		);
		expect(screen.getByRole("button", { name: "正在保存" })).toBeDefined();
		expect(screen.queryByRole("button", { name: "邮件 正在保存 箭头" })).toBeNull();
	});

	it("更新受控 loading 不移除原有文字与图标的占位节点", () => {
		function SaveButton() {
			const [loading, setLoading] = useState(false);
			return (
				<Button
					loading={loading}
					leftIcon={<svg data-testid="icon" />}
					onClick={() => setLoading(true)}
				>
					保存修改
				</Button>
			);
		}
		render(<SaveButton />);
		const icon = screen.getByTestId("icon");
		const label = screen.getByText("保存修改");
		fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
		expect(screen.getByTestId("icon")).toBe(icon);
		expect(screen.getByText("保存修改")).toBe(label);
		expect(screen.getByRole("button", { name: "保存修改" }).getAttribute("aria-busy")).toBe(
			"true",
		);
	});

	it("原生 object ref 与 callback ref 都指向真实 button 并在卸载时清理", () => {
		const objectRef = createRef<HTMLButtonElement>();
		const callbackRef = vi.fn();
		const { unmount } = render(
			<>
				<Button ref={objectRef}>对象引用</Button>
				<Button ref={callbackRef}>回调引用</Button>
			</>,
		);
		expect(objectRef.current).toBe(screen.getByRole("button", { name: "对象引用" }));
		expect(callbackRef).toHaveBeenCalledWith(screen.getByRole("button", { name: "回调引用" }));
		unmount();
		expect(objectRef.current).toBeNull();
		expect(callbackRef.mock.calls.at(-1)?.[0]).toBeNull();
	});

	describe("asChild", () => {
		it("链接保留原生 href 和名称，启用时按 child-first 顺序组合事件", () => {
			const calls: string[] = [];
			render(
				<Button
					asChild
					variant="outline"
					size="sm"
					onClickCapture={() => calls.push("button capture")}
					onClick={() => calls.push("button click")}
				>
					<a
						href="/settings"
						onClickCapture={() => calls.push("child capture")}
						onClick={(event) => {
							event.preventDefault();
							calls.push("child click");
						}}
					>
						设置
					</a>
				</Button>,
			);
			const link = screen.getByRole("link", { name: "设置" });
			expect(link.getAttribute("href")).toBe("/settings");
			expect(link.getAttribute("type")).toBeNull();
			expect(link.getAttribute("disabled")).toBeNull();
			fireEvent.click(link);
			expect(calls).toEqual([
				"child capture",
				"button capture",
				"child click",
				"button click",
			]);
		});

		it("子捕获事件的 defaultPrevented 对按钮处理器可见", () => {
			const capture = vi.fn();
			const click = vi.fn();
			render(
				<Button
					asChild
					onClickCapture={(event) => capture(event.defaultPrevented)}
					onClick={(event) => click(event.defaultPrevented)}
				>
					<a href="/settings" onClickCapture={(event) => event.preventDefault()}>
						设置
					</a>
				</Button>,
			);
			expect(fireEvent.click(screen.getByRole("link", { name: "设置" }))).toBe(false);
			expect(capture).toHaveBeenCalledExactlyOnceWith(true);
			expect(click).toHaveBeenCalledExactlyOnceWith(true);
		});

		it.each([
			"disabled",
			"loading",
		] as const)("%s 链接在任何子点击处理器执行前阻止激活", (state) => {
			const childClick = vi.fn();
			const childCapture = vi.fn();
			const buttonClick = vi.fn();
			const buttonCapture = vi.fn();
			const key = vi.fn();
			const auxiliary = vi.fn();
			render(
				<Button
					asChild
					{...{ [state]: true }}
					onClick={buttonClick}
					onClickCapture={buttonCapture}
				>
					<a
						href="/settings"
						aria-disabled={false}
						tabIndex={0}
						onClick={childClick}
						onClickCapture={childCapture}
						onKeyDown={key}
						onKeyDownCapture={key}
						onKeyUp={key}
						onAuxClick={auxiliary}
						onAuxClickCapture={auxiliary}
					>
						设置
					</a>
				</Button>,
			);
			const link = screen.getByRole("link", { name: "设置" });
			expect(link.getAttribute("aria-disabled")).toBe("true");
			expect(link.getAttribute("tabindex")).toBe("-1");
			expect(link.getAttribute("disabled")).toBeNull();
			expect(fireEvent.click(link)).toBe(false);
			expect(
				fireEvent(
					link,
					new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }),
				),
			).toBe(false);
			for (const activationKey of ["Enter", " "]) {
				expect(fireEvent.keyDown(link, { key: activationKey })).toBe(false);
				expect(fireEvent.keyUp(link, { key: activationKey })).toBe(false);
			}
			for (const handler of [
				childClick,
				childCapture,
				buttonClick,
				buttonCapture,
				key,
				auxiliary,
			]) {
				expect(handler).not.toHaveBeenCalled();
			}
			if (state === "loading") expect(link.getAttribute("aria-busy")).toBe("true");
		});

		it("loading 强制原生子 button 禁用，即使子元素传入 disabled=false", () => {
			const click = vi.fn();
			render(
				<Button asChild loading>
					<button type="button" disabled={false} onClick={click}>
						提交
					</button>
				</Button>,
			);
			const button = screen.getByRole("button", { name: "提交" }) as HTMLButtonElement;
			expect(button.disabled).toBe(true);
			fireEvent.click(button);
			expect(click).not.toHaveBeenCalled();
		});

		it("恢复启用后保留原 tabIndex，并透传自定义 Link 的捕获保护", () => {
			const click = vi.fn();
			function Link(props: ComponentProps<"a">) {
				return <a {...props} />;
			}
			const { rerender } = render(
				<Button asChild disabled>
					<Link href="/settings" tabIndex={0} onClick={click}>
						设置
					</Link>
				</Button>,
			);
			const link = screen.getByRole("link", { name: "设置" });
			fireEvent.click(link);
			expect(click).not.toHaveBeenCalled();
			rerender(
				<Button asChild>
					<Link href="/settings" tabIndex={0} onClick={click}>
						设置
					</Link>
				</Button>,
			);
			expect(link.getAttribute("tabindex")).toBe("0");
			fireEvent.click(link);
			expect(click).toHaveBeenCalledOnce();
		});

		it("Slot 合并子元素 object ref 与按钮 callback ref", () => {
			const childRef = createRef<HTMLButtonElement>();
			const buttonRef = vi.fn();
			const { unmount } = render(
				<Button asChild ref={buttonRef}>
					<button type="button" ref={childRef}>
						复合引用
					</button>
				</Button>,
			);
			const button = screen.getByRole("button", { name: "复合引用" });
			expect(childRef.current).toBe(button);
			expect(buttonRef).toHaveBeenCalledWith(button);
			unmount();
			expect(childRef.current).toBeNull();
			expect(buttonRef).toHaveBeenLastCalledWith(null);
		});

		it("链接 object ref 与子元素 ref 都指向 anchor，并在卸载时清理", () => {
			const buttonRef = createRef<HTMLAnchorElement>();
			const childRef = createRef<HTMLAnchorElement>();
			const { unmount } = render(
				<Button asChild ref={buttonRef}>
					<a href="/settings" ref={childRef}>
						链接引用
					</a>
				</Button>,
			);
			const link = screen.getByRole("link", { name: "链接引用" });
			expect(buttonRef.current).toBe(link);
			expect(childRef.current).toBe(link);
			expect(buttonRef.current?.getAttribute("href")).toBe("/settings");
			unmount();
			expect(buttonRef.current).toBeNull();
			expect(childRef.current).toBeNull();
		});

		it("链接 callback ref 保留 React 19 cleanup，并清理合并的子 ref", () => {
			const cleanup = vi.fn();
			const buttonRef = vi.fn((_element: HTMLAnchorElement | null) => cleanup);
			const childRef = createRef<HTMLAnchorElement>();
			const { unmount } = render(
				<Button asChild ref={buttonRef}>
					<a href="/settings" ref={childRef}>
						回调引用
					</a>
				</Button>,
			);
			const link = screen.getByRole("link", { name: "回调引用" });
			expect(buttonRef).toHaveBeenCalledExactlyOnceWith(link);
			expect(childRef.current).toBe(link);
			unmount();
			expect(cleanup).toHaveBeenCalledOnce();
			expect(buttonRef).toHaveBeenCalledOnce();
			expect(childRef.current).toBeNull();
		});

		it("asChild 保留子元素内容，不把 loadingText 或图标注入链接", () => {
			render(
				<Button
					asChild
					loading
					loadingText="正在跳转"
					leftIcon={<svg data-testid="icon" />}
				>
					<a href="/settings">
						<span>设置</span>
					</a>
				</Button>,
			);
			expect(screen.getByRole("link", { name: "设置" }).getAttribute("aria-busy")).toBe(
				"true",
			);
			expect(screen.queryByText("正在跳转")).toBeNull();
			expect(screen.queryByTestId("icon")).toBeNull();
		});
	});

	it("样式配方只生成公开类名，并保留消费方 className", () => {
		expect(
			buttonVariants({ variant: "outline", size: "sm", className: "bg-primary-base" }).split(
				" ",
			),
		).toEqual(["v-button", "v-button--outline", "v-button--sm", "bg-primary-base"]);
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
