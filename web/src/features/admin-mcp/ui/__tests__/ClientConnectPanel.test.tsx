import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClientConnectPanel } from "../ClientConnectPanel";

describe("ClientConnectPanel", () => {
    afterEach(() => {
        cleanup();
    });
    it("渲染全部客户端切换项，默认展示 Claude Code 安装命令", () => {
        render(<ClientConnectPanel token={null} scopes={null} />);
        for (const label of [
            "Claude Code",
            "Cursor",
            "VS Code",
            "Codex",
            "Gemini CLI",
            "OpenCode",
            "oh-my-pi",
            "Claude Desktop",
            "通用 JSON",
        ]) {
            expect(screen.getByRole("button", { name: label })).toBeTruthy();
        }
        expect(screen.getByText(/claude mcp add --transport http mimo-blog /)).toBeTruthy();
        expect(screen.getByText(/claude mcp add --transport http mimo-blog-scraper /)).toBeTruthy();
    });

    it("有令牌时显示一次性横幅且命令已填入令牌，关闭后令牌不再可见", () => {
        render(<ClientConnectPanel token="tok_secret" scopes={null} />);
        expect(screen.getByText("tok_secret")).toBeTruthy();
        expect(screen.getAllByText(/Bearer tok_secret/).length).toBeGreaterThan(0);
        fireEvent.click(screen.getByTitle("我已保存，关闭提示"));
        expect(screen.queryByText("tok_secret")).toBeNull();
    });

    it("无令牌时配置以 <TOKEN> 占位", () => {
        render(<ClientConnectPanel token={null} scopes={null} />);
        expect(screen.getAllByText(/<TOKEN>/).length).toBeGreaterThan(0);
    });

    it("关闭 server 开关后配置不再包含该 server", () => {
        render(<ClientConnectPanel token={null} scopes={null} />);
        fireEvent.click(screen.getByRole("button", { name: /抓取/ }));
        expect(screen.queryByText(/mcp add --transport http mimo-blog-scraper /)).toBeNull();
        expect(screen.getByText(/mcp add --transport http mimo-blog /)).toBeTruthy();
    });

    it("按令牌 scope 限定可见 server（无抓取权限则不出现）", () => {
        render(<ClientConnectPanel token={null} scopes={["posts:read"]} />);
        expect(screen.queryByRole("button", { name: /抓取/ })).toBeNull();
        expect(screen.queryByText(/mimo-blog-scraper/)).toBeNull();
    });

    it("切换客户端展示对应安装方式（Codex 走环境变量）", () => {
        render(<ClientConnectPanel token={null} scopes={null} />);
        fireEvent.click(screen.getByRole("button", { name: "Codex" }));
        expect(screen.getByText(/codex mcp add mimo-blog --url /)).toBeTruthy();
        expect(screen.getAllByText(/bearer-token-env-var/).length).toBeGreaterThan(0);
    });

    it("Cursor 无令牌时不出 deeplink，展示配置片段", () => {
        render(<ClientConnectPanel token={null} scopes={null} />);
        fireEvent.click(screen.getByRole("button", { name: "Cursor" }));
        expect(screen.queryByText(/安装「文章」到 Cursor/)).toBeNull();
        expect(screen.getByText(/\.cursor\/mcp\.json/)).toBeTruthy();
    });

    it("Cursor 有令牌时出 deeplink 按钮", () => {
        render(<ClientConnectPanel token="tok_secret" scopes={null} />);
        fireEvent.click(screen.getByRole("button", { name: "Cursor" }));
        const link = screen.getByRole("link", { name: /安装「文章」到 Cursor/ });
        expect(link.getAttribute("href")).toContain(
            "cursor://anysphere.cursor-deeplink/mcp/install",
        );
    });
});
