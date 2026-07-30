import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientConnectPanel } from "../ClientConnectPanel";

// shiki 高亮是异步且把文本拆进多个着色 span，与面板行为无关；
// mock 为同步纯文本，让断言聚焦面板自身逻辑。
vi.mock("@shared/ui/markdown-preview/components/CodeBlock", () => ({
    FencedCodeBlock: ({ code }: { code: string; language: string }) => <pre>{code}</pre>,
}));

describe("ClientConnectPanel", () => {
    afterEach(() => {
        cleanup();
    });

    it("渲染全部客户端切换项，默认展示 Claude Code 安装命令", async () => {
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
        expect(await screen.findByText(/claude mcp add --transport http/)).toBeTruthy();
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

    it("Cursor 无令牌时不出 deeplink，展示配置片段", async () => {
        render(<ClientConnectPanel token={null} scopes={null} />);
        fireEvent.click(screen.getByRole("button", { name: "Cursor" }));
        expect(screen.queryByText(/安装「文章」到 Cursor/)).toBeNull();
        expect(await screen.findByText(/\.cursor\/mcp\.json/)).toBeTruthy();
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
