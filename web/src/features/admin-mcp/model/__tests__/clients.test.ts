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
	it("命中文章类 scope 含文章 server 与恒并入的匿名 reader", () => {
		expect(serversForScopes(["posts:read"]).map((s) => s.key)).toEqual([
			"violet-posts",
			"violet-reader",
		]);
	});

	it("抓取与订阅 scope 归入抓取 server，reader 恒并入", () => {
		expect(serversForScopes(["posts:scrape", "subscriptions:read"]).map((s) => s.key)).toEqual([
			"violet-scraper",
			"violet-reader",
		]);
	});

	it("无 scope 命中也返回匿名 reader（恒并入）", () => {
		expect(serversForScopes([]).map((s) => s.key)).toEqual(["violet-reader"]);
	});

	it("comments:read 命中评论 server（reader 恒并入）", () => {
		expect(serversForScopes(["comments:read"]).map((s) => s.key)).toEqual([
			"violet-reader",
			"violet-comments",
		]);
	});
});

describe("MCP_CLIENTS 配置生成", () => {
	it("Claude Code CLI 命令带 transport http 与 Authorization header", () => {
		const view = client("claude-code").primary(ctx());
		if (view.kind !== "commands") {
			throw new Error("expect commands");
		}
		// 4 个 server（violet-posts / scraper / reader / comments）各一条命令
		expect(view.commands).toHaveLength(4);
		expect(view.commands[0]).toContain(
			"claude mcp add --transport http violet-posts https://blog.example.com/api/v1/mcp",
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

	it("只生成选中 server 的配置（reader 恒并入）", () => {
		const view = client("claude-code").primary(
			ctx({ servers: serversForScopes(["posts:read"]) }),
		);
		if (view.kind !== "commands") {
			throw new Error("expect commands");
		}
		// posts:read 命中 violet + reader 恒并入 = 2 条；不含 scraper
		expect(view.commands).toHaveLength(2);
		expect(view.commands.some((c) => c.includes("scraper"))).toBe(false);
	});

	it("OpenCode 片段使用 mcp 键、type remote 与 enabled", () => {
		const view = client("opencode").primary(ctx());
		if (view.kind !== "snippet") {
			throw new Error("expect snippet");
		}
		const parsed = JSON.parse(view.code);
		expect(parsed.mcp["violet-posts"].type).toBe("remote");
		expect(parsed.mcp["violet-posts"].enabled).toBe(true);
		expect(parsed.mcp["violet-posts"].headers.Authorization).toBe("Bearer tok_test_123");
	});

	it("oh-my-pi 片段显式带 type http（省略会被当作 stdio）", () => {
		const view = client("oh-my-pi").primary(ctx());
		if (view.kind !== "snippet") {
			throw new Error("expect snippet");
		}
		expect(JSON.parse(view.code).mcpServers["violet-posts"].type).toBe("http");
	});

	it("VS Code 片段顶层键为 servers", () => {
		const view = client("vscode").fallback?.(ctx());
		if (view?.kind !== "snippet") {
			throw new Error("expect snippet");
		}
		expect(JSON.parse(view.code).servers["violet-posts"].type).toBe("http");
	});

	it("Gemini 片段使用 httpUrl 字段", () => {
		const view = client("gemini-cli").fallback?.(ctx());
		if (view?.kind !== "snippet") {
			throw new Error("expect snippet");
		}
		expect(JSON.parse(view.code).mcpServers["violet-posts"].httpUrl).toBe(
			"https://blog.example.com/api/v1/mcp",
		);
	});

	it("Codex 首选经环境变量传令牌，不落配置文件明文", () => {
		const view = client("codex").primary(ctx());
		if (view.kind !== "commands") {
			throw new Error("expect commands");
		}
		expect(view.commands[0]).toBe("export VIOLET_TOKEN=tok_test_123");
		expect(view.commands[1]).toContain("--bearer-token-env-var VIOLET_TOKEN");
	});

	it("Codex TOML 备选含 http_headers", () => {
		const view = client("codex").fallback?.(ctx());
		if (view?.kind !== "snippet") {
			throw new Error("expect snippet");
		}
		expect(view.lang).toBe("toml");
		expect(view.code).toContain("[mcp_servers.violet-posts]");
		expect(view.code).toContain('Authorization = "Bearer tok_test_123"');
	});

	it("Cursor 有令牌时给 deeplink，config 可解码还原 url 与 header", () => {
		const view = client("cursor").primary(ctx());
		if (view.kind !== "deeplinks") {
			throw new Error("expect deeplinks");
		}
		// 4 个 server 各一个 deeplink
		expect(view.links).toHaveLength(4);
		const url = new URL(view.links[0].href.replace("cursor://", "https://deeplink/"));
		const config = JSON.parse(atob(url.searchParams.get("config") ?? ""));
		expect(config.url).toBe("https://blog.example.com/api/v1/mcp");
		expect(config.headers.Authorization).toBe("Bearer tok_test_123");
	});

	it("Cursor 无令牌时退化为配置片段（deeplink 需要真实令牌）", () => {
		expect(client("cursor").primary(ctx({ token: null })).kind).toBe("snippet");
	});
});

describe("匿名 server 配置不带 Authorization", () => {
	// 混合启用：violet-posts(PAT) + violet-reader(匿名)
	const mixedServers = serversForScopes(["posts:read"]);

	it("JSON snippet 系：匿名 entry 无 headers 键，PAT entry 有", () => {
		const view = client("generic").primary(ctx({ servers: mixedServers }));
		if (view.kind !== "snippet") {
			throw new Error("expect snippet");
		}
		const parsed = JSON.parse(view.code);
		expect(parsed.mcpServers["violet-posts"].headers.Authorization).toBe("Bearer tok_test_123");
		// 匿名 entry 无 headers 键（undefined 被 JSON.stringify 省略）
		expect(parsed.mcpServers["violet-reader"].headers).toBeUndefined();
		expect(parsed.mcpServers["violet-reader"].url).toBe(
			"https://blog.example.com/api/v1/mcp/reader",
		);
	});

	it("Claude Code CLI：匿名命令无 --header，PAT 命令有", () => {
		const view = client("claude-code").primary(ctx({ servers: mixedServers }));
		if (view.kind !== "commands") {
			throw new Error("expect commands");
		}
		const violetCmd = view.commands.find((c) => c.includes("violet-posts")) ?? "";
		const readerCmd = view.commands.find((c) => c.includes("violet-reader")) ?? "";
		expect(violetCmd).toContain("Authorization: Bearer tok_test_123");
		expect(readerCmd).not.toContain("Authorization");
		expect(readerCmd).toContain("/api/v1/mcp/reader");
	});

	it("Codex CLI：匿名命令无 --bearer-token-env-var；全匿名时无 export", () => {
		// 混合：有 PAT server，故有 export
		const mixed = client("codex").primary(ctx({ servers: mixedServers }));
		if (mixed.kind !== "commands") {
			throw new Error("expect commands");
		}
		const readerCmd = mixed.commands.find((c) => c.includes("violet-reader")) ?? "";
		expect(readerCmd).not.toContain("--bearer-token-env-var");

		// 全匿名：无 PAT server，无 export 行
		const readerOnly = serversForScopes([]);
		const anon = client("codex").primary(ctx({ servers: readerOnly }));
		if (anon.kind !== "commands") {
			throw new Error("expect commands");
		}
		expect(anon.commands.some((c) => c.startsWith("export"))).toBe(false);
	});

	it("Codex TOML：匿名 server 无 http_headers 行", () => {
		const view = client("codex").fallback?.(ctx({ servers: mixedServers }));
		if (view?.kind !== "snippet") {
			throw new Error("expect snippet");
		}
		expect(view.code).toContain("[mcp_servers.violet-reader]");
		// reader 块紧跟下一行应是空或下一个 server，不含 http_headers
		const readerBlock = view.code.split("[mcp_servers.violet-reader]")[1] ?? "";
		expect(readerBlock).not.toContain("http_headers");
		expect(view.code).toContain('Authorization = "Bearer tok_test_123"');
	});

	it("Claude Desktop args：匿名 server 无 --header 与 Authorization 值", () => {
		const view = client("claude-desktop").primary(ctx({ servers: mixedServers }));
		if (view.kind !== "snippet") {
			throw new Error("expect snippet");
		}
		const parsed = JSON.parse(view.code);
		expect(parsed.mcpServers["violet-posts"].args).toContain("--header");
		expect(parsed.mcpServers["violet-reader"].args).not.toContain("--header");
		expect(parsed.mcpServers["violet-reader"].args).toEqual([
			"mcp-remote",
			"https://blog.example.com/api/v1/mcp/reader",
		]);
	});
});

describe("violet-comments 评论 server 配置", () => {
	it("PAT server 配置带 Authorization", () => {
		const view = client("generic").primary(
			ctx({ servers: serversForScopes(["comments:read"]) }),
		);
		if (view.kind !== "snippet") {
			throw new Error("expect snippet");
		}
		const parsed = JSON.parse(view.code);
		expect(parsed.mcpServers["violet-comments"].url).toBe(
			"https://blog.example.com/api/v1/mcp/comments",
		);
		expect(parsed.mcpServers["violet-comments"].headers.Authorization).toBe(
			"Bearer tok_test_123",
		);
	});

	it("CreatePATDialog 列出评论 server（非 anonymous，进 scope 勾选区）", () => {
		// violet-comments 是 PAT server（非 anonymous），serversForScopes 推导得到
		const servers = serversForScopes(["comments:read"]);
		expect(servers.some((s) => s.key === "violet-comments")).toBe(true);
		expect(servers.find((s) => s.key === "violet-comments")?.scopes).toEqual(["comments:read"]);
	});
});
