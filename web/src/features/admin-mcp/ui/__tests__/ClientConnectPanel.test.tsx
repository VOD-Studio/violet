import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClientConnectPanel } from "../ClientConnectPanel";

describe("ClientConnectPanel", () => {
	afterEach(() => {
		cleanup();
	});

	it("有令牌时显示一次性横幅且命令已填入令牌，关闭后令牌不再可见", async () => {
		render(<ClientConnectPanel token="tok_secret" scopes={null} />);
		expect(screen.getByText("tok_secret")).toBeTruthy();
		expect((await screen.findAllByText(/Bearer tok_secret/)).length).toBeGreaterThan(0);
		fireEvent.click(screen.getByTitle("我已保存，关闭提示"));
		expect(screen.queryByText("tok_secret")).toBeNull();
	});

	it("无令牌时配置以 <TOKEN> 占位", async () => {
		render(<ClientConnectPanel token={null} scopes={null} />);
		expect((await screen.findAllByText(/<TOKEN>/)).length).toBeGreaterThan(0);
	});

	it("关闭 server 开关后配置不再包含该 server", async () => {
		render(<ClientConnectPanel token={null} scopes={null} />);
		fireEvent.click(screen.getByRole("button", { name: /抓取/ }));
		expect(
			await screen.findByText(/claude mcp add --transport http violet-posts /),
		).toBeTruthy();
		expect(screen.queryByText(/violet-scraper/)).toBeNull();
	});

	it("按令牌 scope 限定可见 server（无抓取权限则不出现）", async () => {
		render(<ClientConnectPanel token={null} scopes={["posts:read"]} />);
		expect(screen.queryByRole("button", { name: /抓取/ })).toBeNull();
		expect((await screen.findAllByText(/violet-posts/)).length).toBeGreaterThan(0);
		expect(screen.queryByText(/violet-scraper/)).toBeNull();
	});

	it("切换客户端展示对应安装方式（Codex 走环境变量）", async () => {
		render(<ClientConnectPanel token={null} scopes={null} />);
		fireEvent.click(screen.getByRole("button", { name: "Codex" }));
		expect(
			(await screen.findAllByText(/codex mcp add violet-posts --url/)).length,
		).toBeGreaterThan(0);
		expect((await screen.findAllByText(/bearer-token-env-var/)).length).toBeGreaterThan(0);
	});

	it("Cursor 无令牌时不出 deeplink", () => {
		render(<ClientConnectPanel token={null} scopes={null} />);
		fireEvent.click(screen.getByRole("button", { name: "Cursor" }));
		expect(screen.queryByText(/安装「文章」到 Cursor/)).toBeNull();
	});

	it("Cursor 有令牌时出 deeplink 按钮", () => {
		render(<ClientConnectPanel token="tok_secret" scopes={null} />);
		fireEvent.click(screen.getByRole("button", { name: "Cursor" }));
		const link = screen.getByRole("link", { name: /安装「文章」到 Cursor/ });
		expect(link.getAttribute("href")).toContain(
			"cursor://anysphere.cursor-deeplink/mcp/install",
		);
	});

	it("令牌编辑后的权限与明文上下文变化会同步到客户端配置", async () => {
		const { rerender } = render(
			<ClientConnectPanel token="tok_created" scopes={["posts:read", "comments:write"]} />,
		);
		expect(screen.getByText("tok_created")).toBeTruthy();
		expect(screen.getByRole("button", { name: /评论/ })).toBeTruthy();

		rerender(<ClientConnectPanel token={null} scopes={["notes:read"]} />);
		expect(screen.queryByText("tok_created")).toBeNull();
		expect(screen.queryByRole("button", { name: /评论/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /文章/ })).toBeNull();
		expect(screen.getByRole("button", { name: /笔记/ })).toBeTruthy();
		expect(
			await screen.findByText(/claude mcp add --transport http violet-notes/),
		).toBeTruthy();
		expect(screen.queryByText(/Bearer tok_created/)).toBeNull();
	});
});
