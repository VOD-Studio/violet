import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ArrowRight, Mail, Plus } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, buttonVariants } from "../button";

describe("Button Component", () => {
	afterEach(cleanup);

	it("默认渲染原生 button 且类型为 button", () => {
		render(<Button>点击我</Button>);
		const btn = screen.getByRole("button", { name: "点击我" });
		expect(btn).toBeDefined();
		expect(btn.getAttribute("type")).toBe("button");
		expect(btn.getAttribute("data-slot")).toBe("button");
		expect(btn.getAttribute("data-variant")).toBe("default");
		expect(btn.getAttribute("data-size")).toBe("default");
	});

	it("支持传入 type='submit'", () => {
		render(<Button type="submit">提交表单</Button>);
		const btn = screen.getByRole("button", { name: "提交表单" });
		expect(btn.getAttribute("type")).toBe("submit");
	});

	it.each([
		"default",
		"brand",
		"secondary",
		"soft",
		"outline",
		"ghost",
		"link",
		"destructive",
	] as const)("正确应用 %s 变体并标记 data-variant", (variant) => {
		render(<Button variant={variant}>{variant} 按钮</Button>);
		const btn = screen.getByRole("button", { name: `${variant} 按钮` });
		expect(btn.getAttribute("data-variant")).toBe(variant);
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
	] as const)("正确应用 %s 尺寸并标记 data-size", (size) => {
		render(
			<Button size={size} aria-label={`按钮 ${size}`}>
				内容
			</Button>,
		);
		const btn = screen.getByRole("button", { name: `按钮 ${size}` });
		expect(btn.getAttribute("data-size")).toBe(size);
	});

	it("正常触发点击事件", () => {
		const handleClick = vi.fn();
		render(<Button onClick={handleClick}>点击测试</Button>);
		fireEvent.click(screen.getByRole("button", { name: "点击测试" }));
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("禁用状态下阻止点击且具备 disabled 属性", () => {
		const handleClick = vi.fn();
		render(
			<Button disabled onClick={handleClick}>
				不可用按钮
			</Button>,
		);
		const btn = screen.getByRole("button", { name: "不可用按钮" });
		expect((btn as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(btn);
		expect(handleClick).not.toHaveBeenCalled();
	});

	describe("加载状态 (loading)", () => {
		it("处于 loading 状态时自动禁用并设置 aria-busy", () => {
			const handleClick = vi.fn();
			render(
				<Button loading onClick={handleClick}>
					保存
				</Button>,
			);
			const btn = screen.getByRole("button", { name: "保存" });
			expect((btn as HTMLButtonElement).disabled).toBe(true);
			expect(btn.getAttribute("aria-busy")).toBe("true");
			expect(btn.getAttribute("data-loading")).toBe("true");
			expect(btn.querySelector("svg.animate-spin")).not.toBeNull();

			fireEvent.click(btn);
			expect(handleClick).not.toHaveBeenCalled();
		});

		it("提供 loadingText 时替换正文内容", () => {
			render(
				<Button loading loadingText="正在同步数据...">
					原本文案
				</Button>,
			);
			expect(screen.queryByText("原本文案")).toBeNull();
			expect(screen.getByText("正在同步数据...")).toBeDefined();
			expect(document.querySelector("svg.animate-spin")).not.toBeNull();
		});

		it("处于 loading 状态时平滑替换 leftIcon 而非双重展示", () => {
			const { rerender } = render(
				<Button leftIcon={<Mail data-testid="mail-icon" />}>发送邮件</Button>,
			);
			expect(screen.getByTestId("mail-icon")).toBeDefined();
			expect(document.querySelector("svg.animate-spin")).toBeNull();

			rerender(
				<Button loading leftIcon={<Mail data-testid="mail-icon" />}>
					发送邮件
				</Button>,
			);
			expect(screen.queryByTestId("mail-icon")).toBeNull();
			expect(document.querySelector("svg.animate-spin")).not.toBeNull();
			expect(screen.getByText("发送邮件")).toBeDefined();
		});

		it("图标按钮处于 loading 状态时不残留旧文本或溢出", () => {
			render(
				<Button size="icon" loading aria-label="新建项目">
					<Plus data-testid="plus-icon" />
				</Button>,
			);
			expect(screen.queryByTestId("plus-icon")).toBeNull();
			expect(document.querySelector("svg.animate-spin")).not.toBeNull();
		});
	});

	describe("图标扩展槽位", () => {
		it("正确渲染 leftIcon 与 rightIcon", () => {
			render(
				<Button
					leftIcon={<Mail data-testid="left-icon" />}
					rightIcon={<ArrowRight data-testid="right-icon" />}
				>
					双图标按钮
				</Button>,
			);
			expect(screen.getByTestId("left-icon")).toBeDefined();
			expect(screen.getByTestId("right-icon")).toBeDefined();
			expect(screen.getByText("双图标按钮")).toBeDefined();
		});
	});

	describe("asChild 模式 (Radix Slot)", () => {
		it("无缝将按钮样式合并至子链接元素", () => {
			render(
				<Button asChild variant="outline" size="sm">
					<a href="/test-link">链接按钮</a>
				</Button>,
			);
			const link = screen.getByRole("link", { name: "链接按钮" });
			expect(link.tagName).toBe("A");
			expect(link.getAttribute("href")).toBe("/test-link");
			expect(link.getAttribute("data-slot")).toBe("button");
			expect(link.getAttribute("data-variant")).toBe("outline");
			expect(link.getAttribute("data-size")).toBe("sm");
		});
	});

	it("导出 buttonVariants 函数供其他组件复用", () => {
		const classes = buttonVariants({ variant: "brand", size: "lg" });
		expect(classes).toContain("bg-brand");
		expect(classes).toContain("h-10");
	});
});
