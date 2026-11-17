import { normalizeLinkUrl } from "@shared/lib/linkify";
import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { remarkChatInline } from "./chat-markdown";

/** 聊天链接保留原始跳转地址，key 只用于卡片去重与查询缓存。 */
export type ChatLink =
	| { kind: "github"; href: string; key: string; repo: string }
	| { kind: "tweet"; href: string; key: string; sourceID: string }
	| { kind: "web"; href: string; key: string };

const chatParser = unified().use(remarkParse).use(remarkChatInline);
const botParser = unified().use(remarkParse).use(remarkGfm);
const tweetHosts: Record<string, true> = {
	"x.com": true,
	"www.x.com": true,
	"mobile.x.com": true,
	"twitter.com": true,
	"www.twitter.com": true,
	"mobile.twitter.com": true,
};
const tweetPath =
	/^\/(?:[A-Za-z0-9_]{1,15}\/status|i\/status|i\/web\/status)\/([1-9][0-9]{0,19})(?:\/(?:photo|video)\/[1-9][0-9]*)?\/?$/;
const repoPath = /^\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9_.-]{1,100})\/?$/;

/** 仅识别 HTTP(S) 链接；推文别名及仓库大小写共享卡片。 */
export function classifyChatLink(href: string): ChatLink | null {
	if (!/^https?:\/\//i.test(href)) return null;
	const normalized = normalizeLinkUrl(href);
	if (!normalized) return null;
	const url = new URL(normalized);
	if (!url.port && tweetHosts[url.hostname]) {
		const match = tweetPath.exec(url.pathname);
		if (match)
			return {
				kind: "tweet",
				href,
				sourceID: match[1],
				key: `https://x.com/i/status/${match[1]}`,
			};
	}
	if (!url.port && (url.hostname === "github.com" || url.hostname === "www.github.com")) {
		const match = repoPath.exec(url.pathname);
		if (match && match[2] !== "." && match[2] !== "..") {
			const repo = `${match[1]}/${match[2]}`;
			return { kind: "github", href, repo, key: `https://github.com/${repo.toLowerCase()}` };
		}
	}
	return { kind: "web", href, key: normalized };
}

/** 按 Markdown 链接节点收集预览，排除代码、图片及未被引用的链接定义。 */
export function collectChatLinks(content: string, variant: "chat" | "bot" = "chat"): ChatLink[] {
	const root: Root = (variant === "bot" ? botParser : chatParser).parse(content);
	const definitions = new Map<string, string>();
	visit(root, "definition", (node) => {
		definitions.set(node.identifier.toLowerCase(), node.url);
	});
	const links = new Map<string, ChatLink>();
	visit(root, (node) => {
		const href =
			node.type === "link"
				? node.url
				: node.type === "linkReference"
					? definitions.get(node.identifier.toLowerCase())
					: undefined;
		if (!href) return;
		const link = classifyChatLink(href);
		if (link && !links.has(link.key)) links.set(link.key, link);
	});
	return [...links.values()];
}
