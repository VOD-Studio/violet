import { AnnouncementBar } from "@violet/ui";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

/** 演示导航条的高度，浮条的 top 偏移与它同源。 */
const NAV_HEIGHT = 52;
/** 浮条离导航的间距，与站点一致。 */
const TOP_GAP = 8;

/** 页面正文占位，让浮条悬在内容之上而不是空白里。 */
function PageBody() {
	return (
		<div aria-hidden="true" className="px-4">
			<div className="h-4 w-2/5 rounded-md bg-muted" />
			<div className="mt-3 h-2.5 w-full rounded-md bg-muted/70" />
			<div className="mt-2 h-2.5 w-11/12 rounded-md bg-muted/70" />
		</div>
	);
}

function AnnouncementInPage({ state }: ExhibitRenderProps) {
	const [visible, setVisible] = useState(true);
	const shown = state === "shown" && visible;
	return (
		<div className="relative size-full overflow-hidden rounded-xl bg-background">
			<div
				aria-hidden="true"
				className="flex items-center gap-3 border-b border-edge-hairline px-4"
				style={{ height: NAV_HEIGHT }}
			>
				<span className="size-6 rounded-full bg-muted" />
				<span className="h-2.5 w-16 rounded-md bg-muted" />
				<span className="ml-auto h-7 w-40 rounded-full bg-card shadow-soft" />
			</div>

			{shown ? (
				<div
					className="absolute inset-x-4 z-10 flex justify-center"
					style={{ top: NAV_HEIGHT + TOP_GAP }}
				>
					<AnnouncementBar
						content="评论编辑器即将支持 Markdown 实时预览"
						link={{ href: "/announcements/12", label: "查看详情" }}
						onClose={() => setVisible(false)}
					/>
				</div>
			) : (
				<p
					className="absolute inset-x-4 text-center text-12 text-muted-foreground"
					style={{ top: NAV_HEIGHT + TOP_GAP + 8 }}
				>
					{state === "empty"
						? "没有公告时整条不渲染，下面的内容不会被推开。"
						: "已关闭：这条公告不再出现，新公告才重现。"}
				</p>
			)}

			<div style={{ paddingTop: NAV_HEIGHT + TOP_GAP + 48 }}>
				<PageBody />
			</div>
		</div>
	);
}

export const announcementBarExhibit: Exhibit = {
	id: "announcement-bar",
	name: "公告浮条",
	units: ["announcement-bar"],
	zone: "banner",
	category: "feedback",
	footprint: { width: 720, height: 180 },
	states: [
		{ id: "shown", label: "有公告" },
		{ id: "empty", label: "没有公告" },
	],
	Render: AnnouncementInPage,
};
