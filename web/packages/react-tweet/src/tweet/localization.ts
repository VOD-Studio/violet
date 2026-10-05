/**
 * 可覆盖的展示文案。
 *
 * 占位符在数字完成 Intl 格式化后替换，不解释为 HTML。
 */
export interface TweetMessages {
	/**
	 * 推文 article 的可访问名称。
	 * @example "X post"
	 */
	tweetLabel: string;
	/**
	 * 原文链接文字。
	 * @example "View original on X"
	 */
	source: string;
	/**
	 * 骨架屏向屏幕阅读器提供的异步加载提示。
	 * @example "Loading post…"
	 */
	loading: string;
	/**
	 * 可重试的请求错误提示。
	 * @example "This post could not be loaded."
	 */
	error: string;
	/**
	 * 手动重试按钮文字。
	 * @example "Try again"
	 */
	retry: string;
	/**
	 * 原因不明的不可用提示。
	 * @example "This post is unavailable."
	 */
	unavailable: string;
	/**
	 * 来源明确确认删除时的提示。
	 * @example "This post has been deleted."
	 */
	deleted: string;
	/**
	 * 来源明确确认私密时的提示。
	 * @example "This post is only visible to approved followers."
	 */
	private: string;
	/**
	 * 作者认证标记的可访问名称。
	 * @example "Verified account"
	 */
	verified: string;
	/** 组织认证徽章的可访问名称。 */
	verifiedBusiness: string;
	/** 政府或多边组织认证徽章的可访问名称。 */
	verifiedGovernment: string;
	/** 来源未提供组织名称时，关联徽标的可访问名称。 */
	affiliation: string;
	/** 打开 X 点赞操作的链接文字。 */
	likeAction: string;
	/** 打开 X 回复编辑器的链接文字。 */
	replyAction: string;
	/** 展开被行数限制的正文。 */
	showMore: string;
	/** 将已展开的正文恢复到配置行数。 */
	showLess: string;
	/**
	 * 超过展示深度或缺少引用内容时的链接文字。
	 * @example "View quoted post"
	 */
	quote: string;
	/**
	 * 照片的默认替代文字。
	 *
	 * {index} 替换为已本地化的序号。
	 * @example "Post photo {index}"
	 */
	photo: string;
	/**
	 * 原图链接的可访问名称。
	 *
	 * {index} 替换为已本地化的序号。
	 * @example "View original photo {index}"
	 */
	viewPhoto: string;
	/**
	 * 照片加载失败时的提示。
	 * @example "Image unavailable"
	 */
	imageUnavailable: string;
	/**
	 * 视频封面的默认替代文字。
	 * @example "Video preview"
	 */
	videoPoster: string;
	/**
	 * 视频封面加载失败时的提示。
	 * @example "Video preview unavailable"
	 */
	videoPosterUnavailable: string;
	/**
	 * 原生视频播放器的可访问名称。
	 * @example "Post video"
	 */
	video: string;
	/**
	 * 原生动图播放器的可访问名称。
	 * @example "Post animation"
	 */
	animation: string;
	/**
	 * 无视频源或播放失败时的原文链接文字。
	 * @example "Watch on X"
	 */
	viewVideo: string;
	/**
	 * 回复统计的无障碍说明模板。
	 *
	 * {count} 替换为已本地化的数字。
	 * @example "{count} replies"
	 */
	replies: string;
	/**
	 * 转发统计的无障碍说明模板。
	 *
	 * {count} 替换为已本地化的数字。
	 * @example "{count} reposts"
	 */
	reposts: string;
	/**
	 * 点赞统计的无障碍说明模板。
	 *
	 * {count} 替换为已本地化的数字。
	 * @example "{count} likes"
	 */
	likes: string;
	/**
	 * 投票不在原生快照中展开时的提示。
	 * @example "View the poll on X."
	 */
	poll: string;
	/**
	 * X 长文章不在原生快照中展开时的提示。
	 * @example "Read the article on X."
	 */
	article: string;
	/**
	 * 来源正文可能被截断时的提示。
	 * @example "This text may be incomplete. View the original on X."
	 */
	incompleteText: string;
	/**
	 * 暂不支持的媒体类型提示。
	 * @example "Some media is only available on X."
	 */
	unsupportedMedia: string;
	/**
	 * 媒体地址被过滤或缺失时的提示。
	 * @example "Some media is unavailable. View the original on X."
	 */
	unavailableMedia: string;
}

/**
 * 显式且可序列化的展示配置。
 *
 * 不读取浏览器语言或机器本地时区，便于服务端渲染与客户端保持一致。
 */
export interface TweetDisplayOptions {
	/**
	 * 正文折叠时的最大行数；实际溢出时显示展开与收起按钮。
	 *
	 * 仅影响本条正文，不折叠媒体或嵌套引用。非正整数按未配置处理。
	 * @default undefined — 展示完整正文。
	 * @example 6
	 */
	maxTextLines?: number;
	/**
	 * 日期、数字及内置消息使用的语言标签。
	 *
	 * 内置英文与简体中文；未知语言使用英文消息，非法标签安全回退。
	 * @default "en-US"
	 * @example "zh-CN"
	 */
	locale?: string;
	/**
	 * 日期显示时区。
	 *
	 * 无效值安全回退为 UTC，不使正文渲染失败。
	 * @default "UTC"
	 * @example "Asia/Shanghai"
	 */
	timeZone?: string;
	/**
	 * 覆盖部分内置文案。
	 *
	 * 不改变原作者正文或自定义警告内容。
	 * @example { source: "Open original", likes: "Likes: {count}" }
	 */
	messages?: Partial<TweetMessages>;
}

const english: TweetMessages = {
	tweetLabel: "X post",
	source: "View original on X",
	loading: "Loading post…",
	error: "This post could not be loaded.",
	retry: "Try again",
	unavailable: "This post is unavailable.",
	deleted: "This post has been deleted.",
	private: "This post is only visible to approved followers.",
	verified: "Verified account",
	verifiedBusiness: "Verified organization",
	verifiedGovernment: "Verified government account",
	affiliation: "Affiliated organization",
	likeAction: "Like on X",
	replyAction: "Reply on X",
	showMore: "Show more",
	showLess: "Show less",
	quote: "View quoted post",
	photo: "Post photo {index}",
	viewPhoto: "View original photo {index}",
	imageUnavailable: "Image unavailable",
	videoPoster: "Video preview",
	videoPosterUnavailable: "Video preview unavailable",
	video: "Post video",
	animation: "Post animation",
	viewVideo: "Watch on X",
	replies: "Replies: {count}",
	reposts: "Reposts: {count}",
	likes: "Likes: {count}",
	poll: "View the poll on X.",
	article: "Read the article on X.",
	incompleteText: "This text may be incomplete. View the original on X.",
	unsupportedMedia: "Some media is only available on X.",
	unavailableMedia: "Some media is unavailable. View the original on X.",
};
const chinese: TweetMessages = {
	tweetLabel: "X 原文",
	source: "在 X 查看原文",
	loading: "正在加载推文…",
	error: "暂时无法加载这条推文",
	retry: "重试",
	unavailable: "这条推文暂不可用",
	deleted: "这条推文已删除",
	private: "这条推文仅对获准的关注者可见",
	verified: "已认证",
	verifiedBusiness: "已认证组织",
	verifiedGovernment: "已认证政府账号",
	affiliation: "关联组织",
	likeAction: "在 X 点赞",
	replyAction: "在 X 回复",
	showMore: "展示更多",
	showLess: "收起",
	quote: "查看引用推文",
	photo: "推文图片 {index}",
	viewPhoto: "查看图片 {index} 原图",
	imageUnavailable: "图片不可用",
	videoPoster: "视频封面",
	videoPosterUnavailable: "视频封面不可用",
	video: "推文视频",
	animation: "推文动图",
	viewVideo: "在 X 查看视频",
	replies: "{count} 回复",
	reposts: "{count} 转发",
	likes: "{count} 赞",
	poll: "投票请在 X 查看",
	article: "X Article 请在 X 查看",
	incompleteText: "正文可能不完整，请在 X 查看原文",
	unsupportedMedia: "部分媒体请在 X 查看",
	unavailableMedia: "部分媒体地址不可用，请在 X 查看",
};

export interface TweetLocalization {
	/** 合并内置预设与宿主覆盖后的界面文案。 */
	messages: TweetMessages;
	/** 使用显式地区设置的数字格式化器。 */
	number: Intl.NumberFormat;
	/** 使用显式地区与时区设置的日期格式化器。 */
	date: Intl.DateTimeFormat;
}

export function resolveLocalization({
	locale = "en-US",
	timeZone = "UTC",
	messages,
}: TweetDisplayOptions): TweetLocalization {
	let language = "en";
	try {
		if (
			!Intl.NumberFormat.supportedLocalesOf(locale).length ||
			!Intl.DateTimeFormat.supportedLocalesOf(locale).length
		) {
			locale = "en-US";
		}
		language = new Intl.Locale(locale).language;
	} catch {
		locale = "en-US";
	}
	const number = new Intl.NumberFormat(locale);
	let date: Intl.DateTimeFormat;
	const dateOptions: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	};
	try {
		date = new Intl.DateTimeFormat(locale, { ...dateOptions, timeZone });
	} catch {
		date = new Intl.DateTimeFormat(locale, { ...dateOptions, timeZone: "UTC" });
	}
	const labels = { ...(language === "zh" ? chinese : english) };
	for (const key of Object.keys(labels) as (keyof TweetMessages)[]) {
		const value = messages?.[key];
		if (typeof value === "string") labels[key] = value;
	}
	return { messages: labels, number, date };
}

export function formatMessage(
	template: string,
	placeholder: "count" | "index",
	value: string,
): string {
	return template.replaceAll(`{${placeholder}}`, value);
}
