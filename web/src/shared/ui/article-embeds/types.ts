/** 文章行内人物提及所需的公开档案。 */
export interface ArticleProfile {
	/** 人物的公开显示名称。 */
	name: string;
	/** 显示在姓名下方的角色或身份说明。 */
	subtitle?: string;
	/** 在资料浮层中展示的纯文本简介。 */
	description?: string;
	/** 头像地址，支持 HTTP(S) 或站内根路径。 */
	avatarUrl?: string;
	/** 点击人物资料时访问的目标地址。 */
	href: string;
}

/** 由文章宿主提供的渲染上下文，不随卡片配置保存。 */
export interface ArticleContentContext {
	/**
	 * 当前公开的人物档案。
	 *
	 * @default undefined — 人物提及只显示文字。
	 */
	profile?: ArticleProfile;
}

/** 文章内的单轮对话配置。 */
export interface DialogueEmbedConfig {
	/** 以纯文本展示的对话正文。 */
	text: string;
	/** 未引用当前人设时使用的发言人名称。 */
	speaker?: string;
	/** 发言人的头像地址，支持 HTTP(S) 或站内根路径。 */
	avatar?: string;
	/** 对话在阅读区域中的对齐方向。 */
	side: "left" | "right";
	/** 使用宿主传入的当前人设；省略时使用手填身份。 */
	profile?: "active";
}

/** GitHub 项目引用的持久化配置；阅读时不请求仓库元数据。 */
export interface GitHubEmbedConfig {
	/**
	 * 仓库所有者与仓库名称，以斜杠分隔。
	 *
	 * @example
	 * { repo: "VOD-Studio/violet" }
	 */
	repo: string;
	/** 项目简介，以纯文本展示。 */
	description?: string;
	/** 仓库主要编程语言的显示名称，不用于决定代码高亮。 */
	language?: string;
	/**
	 * 仓库的 Star 数量。
	 *
	 * 表示保存快照时的统计值，不会自动跟随 GitHub 更新。
	 * 必须为非负整数；传入 0 时显示零。
	 *
	 * @default undefined — 不展示该统计项。
	 * @example
	 * { stars: 128 }
	 */
	stars?: number;
	/**
	 * 仓库的 Fork 数量。
	 *
	 * 表示保存快照时的统计值，不会自动跟随 GitHub 更新。
	 * 必须为非负整数；传入 0 时显示零。
	 *
	 * @default undefined — 不展示该统计项。
	 * @example
	 * { forks: 18 }
	 */
	forks?: number;
	/**
	 * 项目引用的跳转地址。
	 *
	 * 允许 HTTP(S) 或站内根路径；不改变仓库标识和展示数据。
	 *
	 * @default undefined — 使用 https://github.com/{repo}。
	 */
	href?: string;
}

/** 作者保存的网页摘要，不在阅读时抓取目标页面。 */
export interface LinkPreviewEmbedConfig {
	/** 摘要指向的 HTTP(S) 地址或站内根路径。 */
	url: string;
	/** 网页标题，以纯文本展示。 */
	title: string;
	/** 网页的纯文本摘要。 */
	description?: string;
	/** 摘要配图地址；省略时使用链接图标。 */
	image?: string;
	/** 来源站点名称；省略时从目标地址提取主机名。 */
	site?: string;
}

/** 通过来源接口加载内容的推文引用。 */
export interface TweetReferenceConfig {
	/**
	 * X 推文的十进制字符串标识。
	 *
	 * 不转换为 number，避免长标识超过安全整数范围。
	 *
	 * @example
	 * { id: "20" }
	 */
	id: string;
	/** 正整数表示正文折叠行数；省略时为 6 行，0 展示全文，不折叠媒体。 */
	maxTextLines?: number;
}

/** 作者随文章保存的推文快照，不触发来源接口请求。 */
export interface TweetSnapshotConfig {
	/** 原推文地址，供读者访问来源。 */
	url: string;
	/** 原作者的公开显示名称。 */
	author: string;
	/** 原作者账号，允许包含开头的 @。 */
	handle: string;
	/** 推文纯文本正文，不解析其中的 HTML。 */
	text: string;
	/** 原作者头像地址；省略时显示名称首字。 */
	avatar?: string;
	/** 随快照保存的单张配图地址。 */
	image?: string;
	/** 配图的替代文本，供图片不可见或使用辅助技术时阅读。 */
	imageAlt?: string;
	/**
	 * 推文发布时间。
	 *
	 * ISO 时间由组件格式化；已有的非 ISO 日期文字保持原样。
	 *
	 * @default undefined — 不展示时间。
	 * @example
	 * { date: "2026-10-05T08:00:00Z" }
	 */
	date?: string;
	/** 作者是否认证；未知时省略，不据此推断身份。 */
	verified?: boolean;
	/** 正整数表示正文折叠行数；省略时为 6 行，0 展示全文，不折叠媒体。 */
	maxTextLines?: number;
}

/** 引用模式按 ID 加载；快照模式直接展示保存内容。 */
export type TweetEmbedConfig = TweetReferenceConfig | TweetSnapshotConfig;

/** 社交入口支持的图标名称。 */
export type SocialLinkIcon = "github" | "x" | "email" | "website" | "rss" | "video";

/** 一个可访问的社交入口。 */
export interface ArticleSocialLink {
	/** 面向读者的链接名称。 */
	label: string;
	/** 目标地址，支持 HTTP(S)、站内根路径或 mailto。 */
	href: string;
	/** 显示在入口中的账号或联系方式。 */
	handle?: string;
	/** 平台图标；省略时根据目标地址推断。 */
	icon?: SocialLinkIcon;
}

/** 文章内的社交入口组。 */
export interface SocialLinksEmbedConfig {
	/** 按展示顺序排列的入口，数量为 1 至 8 项。 */
	links: ArticleSocialLink[];
}

interface ArticleEmbedConfigMap {
	/** 单轮对话使用的配置。 */
	dialogue: DialogueEmbedConfig;
	/** GitHub 项目引用使用的配置。 */
	github: GitHubEmbedConfig;
	/** 通用网页摘要使用的配置。 */
	"link-preview": LinkPreviewEmbedConfig;
	/** 推文引用或保存快照使用的配置。 */
	tweet: TweetEmbedConfig;
	/** 社交入口组使用的配置。 */
	"social-links": SocialLinksEmbedConfig;
}

/** 文章解析器支持的内容种类，与配置映射保持一致。 */
export type ArticleEmbedKind = keyof ArticleEmbedConfigMap;

/** 按内容种类关联配置类型，避免种类与字段不匹配。 */
export type ParsedArticleEmbed = {
	[Kind in ArticleEmbedKind]: {
		/** 已通过解析的内容种类。 */
		kind: Kind;
		/** 与该种类对应的有效配置。 */
		config: ArticleEmbedConfigMap[Kind];
	};
}[ArticleEmbedKind];
