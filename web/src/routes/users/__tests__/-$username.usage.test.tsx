import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route } from "../$username.usage";

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		Link: ({
			children,
			to,
			...props
		}: { to: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
	};
});

const me = vi.hoisted(() => ({ current: undefined as { username: string } | undefined }));
vi.mock("@features/auth/api/queries", () => ({ useMe: () => ({ data: me.current }) }));

vi.mock("@features/profile/ui/UsageSection", () => ({
	UsageSection: () => <section aria-label="模型用量" />,
}));

function renderPage(username: string) {
	vi.spyOn(Route, "useParams").mockReturnValue({ username });
	const Component = Route.options.component as React.ComponentType;
	render(<Component />);
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	me.current = undefined;
});

describe("/users/$username/usage", () => {
	it("本人看到用量面板", () => {
		me.current = { username: "alice" };
		renderPage("alice");
		expect(screen.getByRole("region", { name: "模型用量" })).toBeTruthy();
	});

	it("登录用户访问他人路径：按未找到处理，不渲染用量面板", () => {
		me.current = { username: "alice" };
		renderPage("bob");
		expect(screen.getByRole("heading", { name: "未找到页面" })).toBeTruthy();
		expect(screen.queryByRole("region", { name: "模型用量" })).toBeNull();
	});

	it("身份未就绪时不渲染任何内容，避免闪出未找到", () => {
		renderPage("alice");
		expect(screen.queryByRole("heading")).toBeNull();
		expect(screen.queryByRole("region", { name: "模型用量" })).toBeNull();
	});
});
