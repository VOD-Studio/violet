import { Button, QuoteCard } from "@violet/ui";
import { X } from "lucide-react";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { cover, portrait } from "./art";

const AVATAR = portrait(28);
const THUMB = cover(210);

const CONTENT = "给博客加了季节。春天落桃花，秋天落桂花，冬天的雪会积在导航上。";

function QuotePreview() {
	const [cancelled, setCancelled] = useState(false);
	return (
		<div className="w-105">
			{cancelled ? (
				<Button variant="secondary" onClick={() => setCancelled(false)}>
					重新引用
				</Button>
			) : (
				<QuoteCard
					authorName="xunrua"
					authorAvatar={AVATAR}
					time="2 小时前"
					content={CONTENT}
					imageSrc={THUMB}
					action={
						<Button
							iconOnly
							variant="ghost"
							aria-label="取消引用"
							onClick={() => setCancelled(true)}
						>
							<X className="size-4" />
						</Button>
					}
				/>
			)}
		</div>
	);
}

function QuoteCardStates({ state }: ExhibitRenderProps) {
	if (state === "preview") return <QuotePreview />;
	if (state === "deleted") {
		return (
			<div className="w-105">
				<QuoteCard deleted />
			</div>
		);
	}

	if (state === "chat") {
		// 聊天卡与推文引用共用唯一的原文链接，宽度跟着气泡走。
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
		{ id: "preview", label: "发布器预览" },
		{ id: "deleted", label: "原文已删除" },
	],
	Render: QuoteCardStates,
};
