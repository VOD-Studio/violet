import { describe, expect, it } from "vitest";
import { type ConfigContext, MCP_CLIENTS, TOKEN_PLACEHOLDER } from "../clients";
import { MCP_SERVERS, serversForScopes } from "../types";

const ctx = (overrides?: Partial<ConfigContext>): ConfigContext => ({
    origin: "https://blog.example.com",
    token: "tok_test_123",
    servers: MCP_SERVERS,
    ...overrides,
});

const client = (key: string) => {
    const c = MCP_CLIENTS.find((x) => x.key === key);
    if (!c) {
        throw new Error(`client ${key} not found`);
    }
    return c;
};

describe("serversForScopes", () => {
    it("命中文章类 scope 只含文章 server", () => {
        expect(serversForScopes(["posts:read"]).map((s) => s.key)).toEqual(["mimo-blog"]);
    });

    it("抓取与订阅 scope 归入抓取 server", () => {
        expect(serversForScopes(["posts:scrape", "subscriptions:read"]).map((s) => s.key)).toEqual([
            "mimo-blog-scraper",
        ]);
    });

    it("无命中返回空数组", () => {
        expect(serversForScopes([])).toEqual([]);
    });
});

describe("MCP_CLIENTS 配置生成", () => {
    it("Claude Code CLI 命令带 transport http 与 Authorization header", () => {
        const view = client("claude-code").primary(ctx());
        if (view.kind !== "commands") {
            throw new Error("expect commands");
        }
        expect(view.commands).toHaveLength(2);
        expect(view.commands[0]).toContain(
            "claude mcp add --transport http mimo-blog https://blog.example.com/api/v1/mcp",
        );
        expect(view.commands[0]).toContain("Authorization: Bearer tok_test_123");
    });

    it("token 为 null 时输出占位符而非真实令牌", () => {
        const view = client("claude-code").primary(ctx({ token: null }));
        if (view.kind !== "commands") {
            throw new Error("expect commands");
        }
        expect(view.commands[0]).toContain(TOKEN_PLACEHOLDER);
    });

    it("只生成选中 server 的配置", () => {
        const view = client("claude-code").primary(
            ctx({ servers: serversForScopes(["posts:read"]) }),
        );
        if (view.kind !== "commands") {
            throw new Error("expect commands");
        }
        expect(view.commands).toHaveLength(1);
        expect(view.commands[0]).not.toContain("scraper");
    });

    it("OpenCode 片段使用 mcp 键、type remote 与 enabled", () => {
        const view = client("opencode").primary(ctx());
        if (view.kind !== "snippet") {
            throw new Error("expect snippet");
        }
        const parsed = JSON.parse(view.code);
        expect(parsed.mcp["mimo-blog"].type).toBe("remote");
        expect(parsed.mcp["mimo-blog"].enabled).toBe(true);
        expect(parsed.mcp["mimo-blog"].headers.Authorization).toBe("Bearer tok_test_123");
    });

    it("oh-my-pi 片段显式带 type http（省略会被当作 stdio）", () => {
        const view = client("oh-my-pi").primary(ctx());
        if (view.kind !== "snippet") {
            throw new Error("expect snippet");
        }
        expect(JSON.parse(view.code).mcpServers["mimo-blog"].type).toBe("http");
    });

    it("VS Code 片段顶层键为 servers", () => {
        const view = client("vscode").fallback?.(ctx());
        if (view?.kind !== "snippet") {
            throw new Error("expect snippet");
        }
        expect(JSON.parse(view.code).servers["mimo-blog"].type).toBe("http");
    });

    it("Gemini 片段使用 httpUrl 字段", () => {
        const view = client("gemini-cli").fallback?.(ctx());
        if (view?.kind !== "snippet") {
            throw new Error("expect snippet");
        }
        expect(JSON.parse(view.code).mcpServers["mimo-blog"].httpUrl).toBe(
            "https://blog.example.com/api/v1/mcp",
        );
    });

    it("Codex 首选经环境变量传令牌，不落配置文件明文", () => {
        const view = client("codex").primary(ctx());
        if (view.kind !== "commands") {
            throw new Error("expect commands");
        }
        expect(view.commands[0]).toBe("export MIMO_BLOG_TOKEN=tok_test_123");
        expect(view.commands[1]).toContain("--bearer-token-env-var MIMO_BLOG_TOKEN");
    });

    it("Codex TOML 备选含 http_headers", () => {
        const view = client("codex").fallback?.(ctx());
        if (view?.kind !== "snippet") {
            throw new Error("expect snippet");
        }
        expect(view.lang).toBe("toml");
        expect(view.code).toContain("[mcp_servers.mimo-blog]");
        expect(view.code).toContain('Authorization = "Bearer tok_test_123"');
    });

    it("Cursor 有令牌时给 deeplink，config 可解码还原 url 与 header", () => {
        const view = client("cursor").primary(ctx());
        if (view.kind !== "deeplinks") {
            throw new Error("expect deeplinks");
        }
        expect(view.links).toHaveLength(2);
        const url = new URL(view.links[0].href.replace("cursor://", "https://deeplink/"));
        const config = JSON.parse(atob(url.searchParams.get("config") ?? ""));
        expect(config.url).toBe("https://blog.example.com/api/v1/mcp");
        expect(config.headers.Authorization).toBe("Bearer tok_test_123");
    });

    it("Cursor 无令牌时退化为配置片段（deeplink 需要真实令牌）", () => {
        expect(client("cursor").primary(ctx({ token: null })).kind).toBe("snippet");
    });
});
