import { EmbeddedTweet, TweetCard, type TweetData } from "@violetjs/react-tweet";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

/** 外站快照：正文带一处提及与一张照片，互动数与时间都来自快照。 */
const EXTERNAL: TweetData = {
	url: "https://x.com/violet_journal/status/1840000000000000000",
	availability: "available",
	snapshot: {
		author: {
			name: "Violet Journal",
			handle: "violet_journal",
			avatarUrl: "/ai-personas/gemini-avatar.webp",
			verification: "individual",
		},
		text: "把遮罩从墨色换成纸色，图片预览就跟着页面四季一起变化了。",
		segments: [
			{ kind: "text", text: "把遮罩从墨色换成纸色，图片预览就跟着页面四季一起变化了。" },
			{ kind: "text", text: " " },
			{ kind: "mention", text: "@violet", url: "https://x.com/violet" },
		],
		publishedAt: "2026-10-28T09:12:00.000Z",
		media: [
			{
				kind: "photo",
				url: "/ai-personas/claude-cover.webp",
				thumbnailUrl: "/ai-personas/claude-avatar.webp",
				width: 1200,
				height: 800,
				alt: "淡紫色封面插画",
			},
		],
		metrics: { likes: 1280, replies: 24, reposts: 96 },
	},
};

/** 来源确认删除：不保留旧正文与媒体，只留原文链接。 */
const UNAVAILABLE: TweetData = {
	url: "https://x.com/i/web/status/1840000000000000001",
	availability: "deleted",
};

/** 本站引用卡片：作者与正文由本站提供，被引用的外站推文走同一套嵌入样式。 */
function SiteQuote() {
	return (
		<TweetCard
			aria-label="本站推文，引用了一条外站推文"
			headerSlot={
				<div className="v-tweet__header">
					<div className="v-tweet__identity">
						<img className="v-tweet__avatar" src="/logo192.png" alt="" />
						<div className="v-tweet__author">
							<span className="v-tweet__name">林间</span>
							<span className="v-tweet__handle">@linjian</span>
						</div>
					</div>
				</div>
			}
			contentSlot={<p className="v-tweet__text">这条引用的排版来自推文包的共享卡片。</p>}
			quoteSlot={
				<EmbeddedTweet tweet={EXTERNAL} compact locale="zh-CN" timeZone="Asia/Shanghai" />
			}
			footerSlot={
				<div className="v-tweet__footer">
					<span className="v-tweet__date">2026-10-30 17:12</span>
				</div>
			}
		/>
	);
}

function TweetEmbed({ state }: ExhibitRenderProps) {
	if (state === "unavailable") {
		return <EmbeddedTweet tweet={UNAVAILABLE} locale="zh-CN" timeZone="Asia/Shanghai" />;
	}
	if (state === "site") return <SiteQuote />;
	return <EmbeddedTweet tweet={EXTERNAL} locale="zh-CN" timeZone="Asia/Shanghai" />;
}

export const tweetEmbedExhibit: Exhibit = {
	id: "tweet-embed",
	name: "外站推文",
	units: ["react-tweet"],
	zone: "content",
	category: "content",
	footprint: { width: 520, height: 800 },
	states: [
		{ id: "external", label: "外站嵌入" },
		{ id: "site", label: "本站引用" },
		{ id: "unavailable", label: "原文不可用" },
	],
	Render: TweetEmbed,
};
