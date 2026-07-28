import type { LucideIcon } from "lucide-react";
import {
    Bot,
    Braces,
    Code2,
    MessageSquare,
    MousePointer2,
    Sparkles,
    SquareCode,
    SquareTerminal,
    Terminal,
} from "lucide-react";
import type { MCPServerSpec } from "./types";

/** 无可用明文令牌时的占位符 */
export const TOKEN_PLACEHOLDER = "<TOKEN>";

/** 配置生成上下文 */
export interface ConfigContext {
    /** 站点源，如 https://blog.example.com */
    origin: string;
    /** 一次性明文令牌；null 时输出占位符 */
    token: string | null;
    /** 待接入的 server（已按 scope 与开关筛选） */
    servers: MCPServerSpec[];
}

/** 安装方式视图模型 */
export type InstallView =
    | { kind: "commands"; title: string; note?: string; commands: string[] }
    | { kind: "deeplinks"; title: string; note?: string; links: { label: string; href: string }[] }
    | {
          kind: "snippet";
          title: string;
          /** 目标配置文件路径（展示用） */
          path: string;
          lang: "json" | "toml";
          code: string;
          note?: string;
      }
    | { kind: "steps"; title: string; steps: string[]; note?: string };

/** MCP 客户端规格，新增客户端在 MCP_CLIENTS 追加即可 */
export interface MCPClientSpec {
    key: string;
    label: string;
    icon: LucideIcon;
    /** 首选安装方式 */
    primary: (ctx: ConfigContext) => InstallView;
    /** 备选安装方式（折叠展示） */
    fallback?: (ctx: ConfigContext) => InstallView;
}

const bearer = (ctx: ConfigContext) => `Bearer ${ctx.token ?? TOKEN_PLACEHOLDER}`;
const urlOf = (ctx: ConfigContext, s: MCPServerSpec) => `${ctx.origin}${s.endpoint}`;
const headersOf = (ctx: ConfigContext) => ({ Authorization: bearer(ctx) });
const toJson = (v: unknown) => JSON.stringify(v, null, 2);

/** 合并多个 server 为 { key: entry } 映射 */
function serverEntries<T>(ctx: ConfigContext, entry: (s: MCPServerSpec) => T): Record<string, T> {
    return Object.fromEntries(ctx.servers.map((s) => [s.key, entry(s)]));
}

const cursorSnippet = (ctx: ConfigContext): InstallView => ({
    kind: "snippet",
    title: "手动编辑配置文件",
    path: "~/.cursor/mcp.json（或项目内 .cursor/mcp.json）",
    lang: "json",
    code: toJson({
        mcpServers: serverEntries(ctx, (s) => ({ url: urlOf(ctx, s), headers: headersOf(ctx) })),
    }),
});

const cursorDeeplink = (ctx: ConfigContext, s: MCPServerSpec) => {
    const config = btoa(JSON.stringify({ url: urlOf(ctx, s), headers: headersOf(ctx) }));
    return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(s.key)}&config=${encodeURIComponent(config)}`;
};

/** 已核实的各客户端 MCP 配置方式 */
export const MCP_CLIENTS: MCPClientSpec[] = [
    {
        key: "claude-code",
        label: "Claude Code",
        icon: SquareTerminal,
        primary: (ctx) => ({
            kind: "commands",
            title: "一键安装（逐条在终端执行）",
            note: "默认写入当前项目配置；追加 --scope user 可全局生效。",
            commands: ctx.servers.map(
                (s) =>
                    `claude mcp add --transport http ${s.key} ${urlOf(ctx, s)} --header "Authorization: ${bearer(ctx)}"`,
            ),
        }),
        fallback: (ctx) => ({
            kind: "snippet",
            title: "手动编辑配置文件",
            path: "~/.claude.json（或项目根 .mcp.json）",
            lang: "json",
            code: toJson({
                mcpServers: serverEntries(ctx, (s) => ({
                    type: "http",
                    url: urlOf(ctx, s),
                    headers: headersOf(ctx),
                })),
            }),
        }),
    },
    {
        key: "cursor",
        label: "Cursor",
        icon: MousePointer2,
        primary: (ctx) =>
            // deeplink 需要真实令牌；占位符模式退化为配置片段
            ctx.token
                ? {
                      kind: "deeplinks",
                      title: "一键安装（点击跳转 Cursor 确认）",
                      links: ctx.servers.map((s) => ({
                          label: `安装「${s.label}」到 Cursor`,
                          href: cursorDeeplink(ctx, s),
                      })),
                  }
                : cursorSnippet(ctx),
        fallback: cursorSnippet,
    },
    {
        key: "vscode",
        label: "VS Code",
        icon: Code2,
        primary: (ctx) => ({
            kind: "commands",
            title: "一键安装（逐条在终端执行）",
            note: "写入用户级配置；项目级请用手动编辑方式。",
            commands: ctx.servers.map(
                (s) =>
                    `code --add-mcp '${JSON.stringify({ name: s.key, type: "http", url: urlOf(ctx, s), headers: headersOf(ctx) })}'`,
            ),
        }),
        fallback: (ctx) => ({
            kind: "snippet",
            title: "手动编辑配置文件",
            path: "项目内 .vscode/mcp.json",
            lang: "json",
            code: toJson({
                servers: serverEntries(ctx, (s) => ({
                    type: "http",
                    url: urlOf(ctx, s),
                    headers: headersOf(ctx),
                })),
            }),
        }),
    },
    {
        key: "codex",
        label: "Codex",
        icon: Bot,
        primary: (ctx) => ({
            kind: "commands",
            title: "一键安装（逐条在终端执行）",
            note: "令牌经环境变量传入，不写入配置文件明文。",
            commands: [
                `export MIMO_BLOG_TOKEN=${ctx.token ?? TOKEN_PLACEHOLDER}`,
                ...ctx.servers.map(
                    (s) =>
                        `codex mcp add ${s.key} --url ${urlOf(ctx, s)} --bearer-token-env-var MIMO_BLOG_TOKEN`,
                ),
            ],
        }),
        fallback: (ctx) => ({
            kind: "snippet",
            title: "手动编辑配置文件",
            path: "~/.codex/config.toml（或项目内 .codex/config.toml）",
            lang: "toml",
            code: ctx.servers
                .map(
                    (s) =>
                        `[mcp_servers.${s.key}]\nurl = "${urlOf(ctx, s)}"\nhttp_headers = { Authorization = "${bearer(ctx)}" }`,
                )
                .join("\n\n"),
        }),
    },
    {
        key: "gemini-cli",
        label: "Gemini CLI",
        icon: Sparkles,
        primary: (ctx) => ({
            kind: "commands",
            title: "一键安装（逐条在终端执行）",
            commands: ctx.servers.map(
                (s) =>
                    `gemini mcp add --transport http ${s.key} ${urlOf(ctx, s)} --header "Authorization: ${bearer(ctx)}"`,
            ),
        }),
        fallback: (ctx) => ({
            kind: "snippet",
            title: "手动编辑配置文件",
            path: "~/.gemini/settings.json",
            lang: "json",
            code: toJson({
                mcpServers: serverEntries(ctx, (s) => ({
                    httpUrl: urlOf(ctx, s),
                    headers: headersOf(ctx),
                })),
            }),
        }),
    },
    {
        key: "opencode",
        label: "OpenCode",
        icon: SquareCode,
        primary: (ctx) => ({
            kind: "snippet",
            title: "编辑配置文件",
            path: "opencode.json（项目根，或 ~/.config/opencode/opencode.json）",
            lang: "json",
            code: toJson({
                mcp: serverEntries(ctx, (s) => ({
                    type: "remote",
                    url: urlOf(ctx, s),
                    enabled: true,
                    headers: headersOf(ctx),
                })),
            }),
        }),
    },
    {
        key: "oh-my-pi",
        label: "oh-my-pi",
        icon: Terminal,
        primary: (ctx) => ({
            kind: "snippet",
            title: "编辑配置文件",
            path: ".omp/mcp.json（项目，或 ~/.omp/agent/mcp.json）",
            lang: "json",
            code: toJson({
                mcpServers: serverEntries(ctx, (s) => ({
                    type: "http",
                    url: urlOf(ctx, s),
                    headers: headersOf(ctx),
                })),
            }),
            note: 'type: "http" 必填，省略会被当作 stdio；也可在 TUI 内用 /mcp add 向导添加。',
        }),
    },
    {
        key: "claude-desktop",
        label: "Claude Desktop",
        icon: MessageSquare,
        primary: (ctx) => ({
            kind: "snippet",
            title: "编辑配置文件",
            path: "claude_desktop_config.json（macOS: ~/Library/Application Support/Claude/）",
            lang: "json",
            code: toJson({
                mcpServers: serverEntries(ctx, (s) => ({
                    command: "npx",
                    args: [
                        "mcp-remote",
                        urlOf(ctx, s),
                        "--header",
                        `Authorization: ${bearer(ctx)}`,
                    ],
                })),
            }),
            note: "经 mcp-remote 桥接远程 server；保存后完全退出并重启 Claude Desktop。",
        }),
    },
    {
        key: "generic",
        label: "通用 JSON",
        icon: Braces,
        primary: (ctx) => ({
            kind: "snippet",
            title: "通用配置片段",
            path: "各客户端的 MCP 配置文件",
            lang: "json",
            code: toJson({
                mcpServers: serverEntries(ctx, (s) => ({
                    type: "http",
                    url: urlOf(ctx, s),
                    headers: headersOf(ctx),
                })),
            }),
            note: "适用于支持 Streamable HTTP 的其他客户端（Windsurf、Zed 等），按其文档调整键名。",
        }),
    },
];
