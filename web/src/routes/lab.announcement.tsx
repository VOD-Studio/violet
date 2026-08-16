import { byNewest } from "@features/lab/announcement/model/event";
import { MOCK_ANNOUNCEMENTS } from "@features/lab/announcement/model/mock";
import {
	type AnnouncementDirection,
	AnnouncementSkeleton,
} from "@features/lab/announcement/ui/AnnouncementSkeleton";
import { EventLog } from "@features/lab/announcement/ui/EventLog";
import { NoticeBoard } from "@features/lab/announcement/ui/NoticeBoard";
import { StatusBoard } from "@features/lab/announcement/ui/StatusBoard";
import { LabHeader } from "@features/lab/ui/LabHeader";
import Empty from "@shared/ui/empty";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

type PreviewState = "data" | "skeleton" | "empty";

const DIRECTIONS: { value: AnnouncementDirection; label: string; intent: string }[] = [
	{
		value: "log",
		label: "事件日志",
		intent: "公告是站点的运营日志：倒序事件流一行一条，mono 时间戳 + 三字母电码 + 色点，进行中的故障与维护压色边线。占地最小、密度最高，最安静的一版。",
	},
	{
		value: "status",
		label: "状态面板",
		intent: "像 status page 一样先看健康再读事件：顶部总览由进行中公告的最高严重度推导，下方按进行中 / 未生效 / 已收档分组，生效窗口与影响范围第一次有了结构位置。",
	},
	{
		value: "board",
		label: "告示板",
		intent: "布告栏的显要度语法：severity 决定纸张大小——进行中的故障与维护是整栏大告示，发布动态是半栏中告示，日常信息与已收档是小票据，已收档的褪色盖戳让位。",
	},
];

/**
 * /lab/announcement - 公告原型实验室
 *
 * 聚焦首页公告区（card / article 两形态）的三方向对比，附数据 /
 * 骨架屏 / 空三态预览，静态 mock 不接 API。选定方向后生产实现
 * （首页 AnnouncementGrid）按选定方向落地。banner 形态由生产
 * AnnouncementBar 现役承担，不在本 lab 范围。
 */
function AnnouncementLab() {
	const [direction, setDirection] = useState<AnnouncementDirection>("log");
	const [preview, setPreview] = useState<PreviewState>("data");
	const active = DIRECTIONS.find((d) => d.value === direction) ?? DIRECTIONS[0];

	return (
		<div className="container mx-auto px-6 py-24">
			<LabHeader to="/lab/announcement" />

			<section>
				<h2 className="mb-2 text-2xl font-semibold">展示态方向</h2>
				<p className="mb-8 text-sm text-muted-foreground">
					同一组 mock 公告（7 条，覆盖四种 severity 与 card / article
					两形态，含未生效与已收档样本）在三个方向下的渲染。 右侧可切换数据 / 骨架屏 /
					空态。
				</p>

				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<Segmented
						value={direction}
						onValueChange={setDirection}
						segments={DIRECTIONS.map((d) => ({ value: d.value, label: d.label }))}
						size="default"
					/>
					<Segmented
						value={preview}
						onValueChange={setPreview}
						segments={[
							{ value: "data", label: "数据" },
							{ value: "skeleton", label: "骨架屏" },
							{ value: "empty", label: "空态" },
						]}
					/>
				</div>

				<p className="mb-6 font-mono text-xs text-muted-foreground">
					<span className="mr-2 tracking-[0.3em] text-muted-foreground/60 uppercase">
						Intent
					</span>
					{active.intent}
				</p>

				{/* 近生产预览框：模拟首页公告区块语境 */}
				<div className="rounded-2xl border border-edge-hairline bg-background/40 p-6 md:p-10">
					<p className="mb-8 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase">
						Preview · violet.blog · {active.label}
					</p>

					<header className="mb-10">
						<p className="mb-2 font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
							Announcements
						</p>
						<h3 className="font-mono text-4xl font-bold">公告</h3>
					</header>

					{preview === "data" ? (
						<div key={direction}>
							{direction === "log" ? (
								<EventLog items={byNewest(MOCK_ANNOUNCEMENTS)} />
							) : null}
							{direction === "status" ? (
								<StatusBoard items={MOCK_ANNOUNCEMENTS} />
							) : null}
							{direction === "board" ? (
								<NoticeBoard items={MOCK_ANNOUNCEMENTS} />
							) : null}
						</div>
					) : null}

					{preview === "skeleton" ? (
						<AnnouncementSkeleton key={`sk-${direction}`} direction={direction} />
					) : null}

					{preview === "empty" ? (
						<Empty
							key="empty"
							size="lg"
							title="NO EVENTS"
							description="站点安静运行中，没有需要你知道的事。"
							className="py-16"
						/>
					) : null}
				</div>
			</section>
		</div>
	);
}

export const Route = createFileRoute("/lab/announcement")({
	component: AnnouncementLab,
});
