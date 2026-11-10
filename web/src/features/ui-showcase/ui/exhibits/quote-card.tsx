import { QuoteCard } from "@violet/ui";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { cover, portrait } from "./art";

const AVATAR = portrait(28);
const THUMB = cover(210);

const CONTENT = "给博客加了季节。春天落桃花，秋天落桂花，冬天的雪会积在导航上。";

function QuoteCardStates({ state }: ExhibitRenderProps) {
	if (state === "deleted") {
		return (
			<div className="w-105">
				<QuoteCard deleted />
			</div>
		);
	}

	if (state === "chat") {
		// 聊天里作者可点，卡片宽度跟着气泡走，点击整卡进推文详情。
		return (
			<div className="w-80 max-w-full">
				<QuoteCard
					href="/tweets/9f2c"
					label="查看 xunrua 的这条推文"
					authorName="xunrua"
					authorAvatar={AVATAR}
					time="2 小时前"
					timeTitle="2026-11-10 09:12"
					content={CONTENT}
					imageSrc={THUMB}
					renderAuthor={({ name, avatar }) => (
						<a className="v-quote-card__author" href="#author">
							{avatar && (
								<img
									className="v-quote-card__avatar"
									src={avatar}
									alt=""
									width={20}
									height={20}
								/>
							)}
							<span className="v-quote-card__name">{name}</span>
						</a>
					)}
				/>
			</div>
		);
	}

	if (state === "nested") {
		return (
			<div className="w-105">
				<QuoteCard
					href="/tweets/9f2c"
					label="查看 xunrua 的这条推文"
					authorName="xunrua"
					authorAvatar={AVATAR}
					time="2 小时前"
					content={CONTENT}
					nested="引用了一条推文"
				/>
			</div>
		);
	}

	return (
		<div className="w-105">
			<QuoteCard
				href="/tweets/9f2c"
				label="查看 xunrua 的这条推文"
				authorName="xunrua"
				authorAvatar={AVATAR}
				time="2 小时前"
				timeTitle="2026-11-10 09:12"
				content={CONTENT}
				imageSrc={THUMB}
			/>
		</div>
	);
}

export const quoteCardExhibit: Exhibit = {
	id: "quote-card",
	name: "引用卡",
	units: ["quote-card"],
	zone: "content",
	category: "content",
	footprint: { width: 520, height: 180 },
	states: [
		{ id: "tweet", label: "引用推文" },
		{ id: "chat", label: "聊天分享" },
		{ id: "nested", label: "嵌套引用" },
		{ id: "deleted", label: "原文已删除" },
	],
	Render: QuoteCardStates,
};
