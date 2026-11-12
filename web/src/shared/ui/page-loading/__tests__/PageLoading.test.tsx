import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageLoading } from "../PageLoading";

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ invalidate: vi.fn() }),
	Link: ({
		children,
		to,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
		<a href={to ?? "/"} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@shared/lib/theme-preference", () => ({
	getClientThemeState: () => ({ preset: "summer" }),
}));

describe("PageLoading", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("300ms 内不渲染任何内容", () => {
		const { container } = render(<PageLoading label="测试载入中" />);
		expect(container.firstChild).toBeNull();
		act(() => {
			vi.advanceTimersByTime(290);
		});
		expect(container.firstChild).toBeNull();
	});

	it("超过 300ms 后渲染当季花形，0 到 2 秒内不展示文字", () => {
		const { container } = render(<PageLoading label="测试载入中" />);
		act(() => {
			vi.advanceTimersByTime(350);
		});
		expect(container.querySelector(".v-flower--lotus")).toBeTruthy();
		expect(screen.queryByText("测试载入中")).toBeNull();
	});

	it("2 到 8 秒之间展示提示文案", () => {
		render(<PageLoading label="正在载入专栏页面…" />);
		act(() => {
			vi.advanceTimersByTime(2100);
		});
		expect(screen.getByText("正在载入专栏页面…")).toBeTruthy();
		expect(screen.queryByText("重新加载")).toBeNull();
	});

	it("超过 8 秒提供重新加载与返回首页操作", () => {
		render(<PageLoading />);
		act(() => {
			vi.advanceTimersByTime(8100);
		});
		expect(screen.getByRole("button", { name: "重新加载" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "返回首页" })).toBeTruthy();
	});
});
