export interface ArticleProfile {
	name: string;
	subtitle?: string;
	description?: string;
	avatarUrl?: string;
	href: string;
}

export interface ArticleContentContext {
	profile?: ArticleProfile;
}

export type ArticleEmbedKind = "dialogue" | "github" | "link-preview" | "tweet" | "social-links";

export interface DialogueEmbedConfig {
	text: string;
	speaker?: string;
	avatar?: string;
	side: "left" | "right";
	profile?: "active";
}

export interface GitHubEmbedConfig {
	repo: string;
	description?: string;
	language?: string;
	stars?: number;
	forks?: number;
	href?: string;
}

export interface LinkPreviewEmbedConfig {
	url: string;
	title: string;
	description?: string;
	image?: string;
	site?: string;
}

export interface TweetEmbedConfig {
	url: string;
	author: string;
	handle: string;
	text: string;
	avatar?: string;
	image?: string;
	imageAlt?: string;
	date?: string;
	verified?: boolean;
}

export type SocialLinkIcon = "github" | "x" | "email" | "website" | "rss" | "video";

export interface ArticleSocialLink {
	label: string;
	href: string;
	handle?: string;
	icon?: SocialLinkIcon;
}

export interface SocialLinksEmbedConfig {
	links: ArticleSocialLink[];
}

export type ParsedArticleEmbed =
	| { kind: "dialogue"; config: DialogueEmbedConfig }
	| { kind: "github"; config: GitHubEmbedConfig }
	| { kind: "link-preview"; config: LinkPreviewEmbedConfig }
	| { kind: "tweet"; config: TweetEmbedConfig }
	| { kind: "social-links"; config: SocialLinksEmbedConfig };
