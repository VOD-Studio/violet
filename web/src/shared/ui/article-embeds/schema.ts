import { z } from "zod";
import type { ArticleEmbedKind, ParsedArticleEmbed } from "./types";
import { isSafeArticleHref, isSafeArticleImage } from "./url";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const href = z
	.string()
	.trim()
	.refine((value) => isSafeArticleHref(value), "链接不安全");
const socialHref = z
	.string()
	.trim()
	.refine((value) => isSafeArticleHref(value, true), "链接不安全");
const image = z
	.string()
	.trim()
	.refine((value) => isSafeArticleImage(value), "图片链接不安全")
	.optional();

const dialogueSchema = z.object({
	text: text(4000),
	speaker: optionalText(80),
	avatar: image,
	side: z.enum(["left", "right"]).default("left"),
	profile: z.literal("active").optional(),
});

const githubSchema = z.object({
	repo: text(160).regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u),
	description: optionalText(500),
	language: optionalText(48),
	stars: z.number().int().nonnegative().optional(),
	forks: z.number().int().nonnegative().optional(),
	href: href.optional(),
});

const linkPreviewSchema = z.object({
	url: href,
	title: text(240),
	description: optionalText(600),
	image,
	site: optionalText(120),
});

const tweetSchema = z.object({
	url: href,
	author: text(100),
	handle: text(100),
	text: text(4000),
	avatar: image,
	image,
	imageAlt: optionalText(300),
	date: optionalText(80),
	verified: z.boolean().optional(),
});

const socialLinksSchema = z.object({
	links: z
		.array(
			z.object({
				label: text(80),
				href: socialHref,
				handle: optionalText(120),
				icon: z.enum(["github", "x", "email", "website", "rss", "video"]).optional(),
			}),
		)
		.min(1)
		.max(8),
});

/** 严格解析卡片 JSON；无效配置交给调用方显示可读降级，而非让整篇文章崩溃。 */
export function parseArticleEmbed(
	kind: ArticleEmbedKind,
	source: string,
): ParsedArticleEmbed | null {
	let input: unknown;
	try {
		input = JSON.parse(source);
	} catch {
		return null;
	}

	switch (kind) {
		case "dialogue": {
			const result = dialogueSchema.safeParse(input);
			return result.success ? { kind, config: result.data } : null;
		}
		case "github": {
			const result = githubSchema.safeParse(input);
			return result.success ? { kind, config: result.data } : null;
		}
		case "link-preview": {
			const result = linkPreviewSchema.safeParse(input);
			return result.success ? { kind, config: result.data } : null;
		}
		case "tweet": {
			const result = tweetSchema.safeParse(input);
			return result.success ? { kind, config: result.data } : null;
		}
		case "social-links": {
			const result = socialLinksSchema.safeParse(input);
			return result.success ? { kind, config: result.data } : null;
		}
	}
}
