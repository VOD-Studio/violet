import type { TweetAuthor } from "./author.ts";
import type { TweetMedia } from "./media.ts";

/**
 * 推文的内容可用性。
 *
 * 只有 available 状态允许携带可展示内容。
 */
export type TweetAvailability = "available" | "unavailable" | "deleted" | "private";

/**
 * 可供阅读的推文。
 *
 * 正文快照为必需字段，不能用缺失快照表达尚未加载。
 */
export interface AvailableTweet {
	/**
	 * X 平台的十进制推文标识。
	 * @example "20"
	 */
	id?: string;
	/**
	 * 原文地址，支持 HTTP(S) 或同源根相对路径。
	 * @example "https://x.com/jack/status/20"
	 */
	url: string;
	/**
	 * 明确允许展示快照内容。
	 * @example "available"
	 */
	availability: "available";
	/**
	 * 作者、正文和媒体的真实快照。
	 *
	 * 空字符串正文仍可承载媒体，不能将其当作不可用状态。
	 */
	snapshot: TweetSnapshot;
	/**
	 * 被引用的推文。
	 *
	 * 组件最多展开一层，更深引用仅保留原文链接。
	 */
	quotedTweet?: TweetData | null;
}

/**
 * 已知不可用的推文。
 *
 * 禁止携带残留正文或引用，也不会由展示组件再次发起抓取。
 */
export interface UnavailableTweet {
	/**
	 * X 平台的十进制推文标识。
	 * @example "20"
	 */
	id?: string;
	/**
	 * 供读者确认来源状态的原文地址。
	 * @example "https://x.com/i/web/status/20"
	 */
	url: string;
	/**
	 * 不可用原因。
	 *
	 * 无法从来源确认删除或私密时使用 unavailable。
	 */
	availability: Exclude<TweetAvailability, "available">;
	/**
	 * 不可用状态禁止保留正文快照。
	 *
	 * 外部不可信数据即使违规携带，组件也不会展示。
	 */
	snapshot?: never;
	/**
	 * 不可用状态禁止保留引用内容。
	 *
	 * 引用不得绕过父推文的可用性检查。
	 */
	quotedTweet?: never;
}

/**
 * 以可用性判别的推文数据。
 *
 * 先检查 availability 再读取可用状态的快照。
 */
export type TweetData = AvailableTweet | UnavailableTweet;

/**
 * 来源提供的互动统计。
 *
 * 缺失字段不展示，也不补零；非法或负数在渲染时忽略。
 */
export interface TweetMetrics {
	/**
	 * 点赞数。
	 * @example 1250
	 */
	likes?: number;
	/**
	 * 回复数。
	 * @example 12
	 */
	replies?: number;
	/**
	 * 转发数。
	 * @example 30
	 */
	reposts?: number;
}

/**
 * 可本地化的来源限制提示码。
 *
 * 与宿主提供的自由文本 warnings 分离，不在数据 API 固定界面语言。
 */
export type TweetNotice =
	| "poll"
	| "article"
	| "truncated"
	| "unsupported-media"
	| "media-unavailable";

/**
 * 可直接渲染而无需网络请求的正文快照。
 *
 * 原作者文本与宿主自由文本警告不会被本地化配置翻译。
 */
export interface TweetSnapshot {
	/**
	 * 原作者身份。
	 *
	 * 姓名与账号始终保留为文字。
	 */
	author: TweetAuthor;
	/**
	 * 完整纯文本正文。
	 *
	 * 没有结构化片段时直接展示，永远不按 HTML 解释。
	 */
	text: string;
	/**
	 * 按正文顺序排列的结构化片段。
	 *
	 * 片段存在时用于展示链接、账号提及与话题标签。
	 */
	segments?: TweetSegment[] | null;
	/**
	 * 来源的发布时间。
	 *
	 * ISO 时间按配置时区展示，旧格式纯文本原样保留。
	 * @example "2006-03-21T20:50:14.000Z"
	 */
	publishedAt?: string;
	/**
	 * 图片、视频或动图列表。
	 *
	 * 每项必须有真实原图、播放源或明确的封面地址。
	 */
	media?: TweetMedia[] | null;
	/**
	 * 引用原文地址。
	 *
	 * 缺少引用内容或超过一层展开限制时用于跳转。
	 */
	quoteUrl?: string;
	/**
	 * 宿主提供的自由文本警告。
	 *
	 * 按原样显示，不自动翻译；可本地化提示使用 notices。
	 */
	warnings?: string[] | null;
	/**
	 * 由组件消息配置翻译的来源限制提示。
	 * @example ["poll", "truncated"]
	 */
	notices?: TweetNotice[] | null;
	/**
	 * 来源明确提供的互动统计。
	 *
	 * 数字按显式 locale 格式化，不伪造缺失指标。
	 */
	metrics?: TweetMetrics;
}

/**
 * 可交互正文片段的种类。
 *
 * 三种片段都要求明确的目标地址。
 */
export type TweetLinkKind = "link" | "mention" | "hashtag";

/**
 * 不携带链接的纯文本片段。
 *
 * 可用于保留无法安全导航的来源文本。
 */
export interface TweetTextSegment {
	/**
	 * 纯文本判别值。
	 * @example "text"
	 */
	kind: "text";
	/**
	 * 以文本节点输出的内容。
	 * @example "Hello world"
	 */
	text: string;
	/**
	 * 纯文本片段不能携带链接。
	 *
	 * 可导航内容应使用 TweetLinkSegment。
	 */
	url?: never;
}

/**
 * 有明确目标地址的可交互片段。
 *
 * 运行时仍会检查协议，不将类型标注作为安全保证。
 */
export interface TweetLinkSegment {
	/**
	 * 普通链接、账号提及或话题标签。
	 * @example "mention"
	 */
	kind: TweetLinkKind;
	/**
	 * 面向读者的链接文字。
	 * @example "@jack"
	 */
	text: string;
	/**
	 * HTTP(S) 或同源根相对目标地址。
	 * @example "https://x.com/jack"
	 */
	url: string;
}

/**
 * 纯文本与可交互片段的判别联合。
 *
 * 不允许缺少地址的链接或携带地址的纯文本。
 */
export type TweetSegment = TweetTextSegment | TweetLinkSegment;
