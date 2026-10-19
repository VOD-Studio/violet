import { parseTweetId } from "@violetjs/react-tweet/api";
import { z } from "zod";
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

const maxTextLines = z.number().int().nonnegative().optional();

const tweetSnapshotSchema = z.object({
	url: href,
	author: text(100),
	handle: text(100),
	text: text(4000),
	avatar: image,
	image,
	imageAlt: optionalText(300),
	date: optionalText(80),
	verified: z.boolean().optional(),
	maxTextLines,
});

const tweetSchema = z.union([
	tweetSnapshotSchema,
	z.object({ id: text(20).regex(/^[1-9]\d*$/u), maxTextLines }).strict(),
	z
		.object({
			url: href.refine((value) => parseTweetId(value) !== null, "需要 X 或 Twitter 推文链接"),
			maxTextLines,
		})
		.strict()
		.transform(({ url, maxTextLines }) => ({ id: parseTweetId(url) as string, maxTextLines })),
]);

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

/** 内置嵌入的配置校验，按种类索引；无效配置交给宿主显示可读降级，而非让整篇文章崩溃。 */
export const BUILTIN_SCHEMAS = {
	dialogue: dialogueSchema,
	github: githubSchema,
	"link-preview": linkPreviewSchema,
	tweet: tweetSchema,
	"social-links": socialLinksSchema,
};

/** 用 zod 校验配置：通过时返回整理后的值，否则返回 null。 */
export const parseWith =
	<Schema extends z.ZodType>(schema: Schema) =>
	(input: unknown): z.output<Schema> | null => {
		const result = schema.safeParse(input);
		return result.success ? result.data : null;
	};
