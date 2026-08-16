import { byNewest } from "@features/lab/announcement/model/event";
import { MOCK_ANNOUNCEMENTS, MOCK_BANNERS } from "@features/lab/announcement/model/mock";
import {
	type AnnouncementDirection,
	AnnouncementSkeleton,
} from "@features/lab/announcement/ui/AnnouncementSkeleton";
import { BannerCrossfade } from "@features/lab/announcement/ui/BannerCrossfade";
import { BannerPrism } from "@features/lab/announcement/ui/BannerPrism";
import { BannerSlide } from "@features/lab/announcement/ui/BannerSlide";
import { BannerTeletype } from "@features/lab/announcement/ui/BannerTeletype";
import { EventLog } from "@features/lab/announcement/ui/EventLog";
import { NoticeBoard } from "@features/lab/announcement/ui/NoticeBoard";
import { Receipts } from "@features/lab/announcement/ui/Receipts";
import { StatusBoard } from "@features/lab/announcement/ui/StatusBoard";
import { Ticker } from "@features/lab/announcement/ui/Ticker";
import { LabHeader } from "@features/lab/ui/LabHeader";
import Empty from "@shared/ui/empty";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

type PreviewState = "data" | "skeleton" | "empty";
type BannerDirection = "prism" | "crossfade" | "slide" | "teletype";

const DIRECTIONS: { value: AnnouncementDirection; label: string; intent: string }[] = [
	{
		value: "log",
		label: "事件日志",
		intent: "公告是站点的运营日志：倒序事件流一行一条，mono 时间戳 + 三字母电码 + 色点，进行中的故障与维护压色边线。占地最小、密度最高，已落生产首页。",
	},
	{
		value: "status",
		label: "状态面板",
		intent: "像 status page 一样先看健康再读事件：顶部总览由进行中公告的最高严重度推导，下方按进行中 / 未生效 / 已收档分组，生效窗口与影响范围第一次有了结构位置。",
	},
	{
		value: "board",
		label: "告示板",
		intent: "布告栏的显要度语法：severity 决定纸张大小——进行中的故障与维护是整栏大告示，发布动态是半栏中告示，日常信息与已收档是指甲盖小票据，已收档的褪色盖戳让位；kicker 用布告语汇（通知 / 维护 / 发布 / 故障）。",
	},
	{
		value: "ticker",
		label: "速览带",
		intent: "公告不值得一块版面：全部公告压成一条横向无缝滚动的速览带，色点 + 标题循环流过，hover 停下细看。占地最极端的一版——一条带子滚完所有运营事件。",
	},
	{
		value: "receipts",
		label: "票据卷",
		intent: "公告是系统开出的票据：等宽打印小票无大小层级，锯齿毛边 + 虚线撕裂线 + 存根联（条码 / 编号 / 状态章），article 的存根联就是简报入口。与告示板的层级张贴错开。",
	},
];

const BANNER_DIRECTIONS: { value: BannerDirection; label: string; intent: string }[] = [
	{
		value: "prism",
		label: "棱柱旋转",
		intent: "机场翻牌显示屏式的正交 3D 滚筒：N 面实体面板翻到当前面，结构感来自滚筒遮挡，旋转只是压扁再展开——没有透视的近大远小，不会有「放大再缩小」的呼吸感。落定后切静态层，静止态文字始终清晰。",
	},
	{
		value: "crossfade",
		label: "渐隐轮换",
		intent: "同一位置整条淡入淡出（300ms），无位移、无 3D。最安静的横幅——装置感为零，只有文字在换。",
	},
	{
		value: "slide",
		label: "滑轨推入",
		intent: "新公告从右侧推入、旧公告推出，底部 2px 驻留进度线把「还有几秒换下一条」可视化。信息最透明的一版。",
	},
	{
		value: "teletype",
		label: "电传打字",
		intent: "公告像电传机逐字打上横幅：打出 → 驻留（光标闪烁）→ 快速退格清屏 → 打下一条，节拍由文本长度自然决定。与全站终端 DNA 同源，叙事感最强的一版。",
	},
];

/**
 * /lab/announcement - 公告原型实验室
 *
 * 两个对比面：首页公告区（card / article 两形态，五方向 × 三态）
 * 与顶部横幅（banner 形态，四候选——棱柱旋转为正交 3D 滚筒：无
 * 透视畸变，落定切静态层根治模糊）。静态 mock 不接 API；
 * 横幅三条不变约束（后端排序 / 关闭即已读 / 动画可暂停）在每个方向上保持。
 */
function AnnouncementLab() {
	const [direction, setDirection] = useState<AnnouncementDirection>("log");
	const [preview, setPreview] = useState<PreviewState>("data");
	const [banner, setBanner] = useState<BannerDirection>("prism");
	const active = DIRECTIONS.find((d) => d.value === direction) ?? DIRECTIONS[0];
	const activeBanner = BANNER_DIRECTIONS.find((d) => d.value === banner) ?? BANNER_DIRECTIONS[0];

	return (
		<div className="container mx-auto px-6 py-24">
			<LabHeader to="/lab/announcement" />

			{/* ============ 公告区展示方向：五方向 × 三态 ============ */}
			<section className="mb-24">
				<h2 className="mb-2 text-2xl font-semibold">公告区展示方向</h2>
				<p className="mb-8 text-sm text-muted-foreground">
					同一组 mock 公告（7 条，覆盖四种 severity 与 card / article
					两形态，含未生效与已收档样本）在五个方向下的渲染。 右侧可切换数据 / 骨架屏 /
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
							{direction === "ticker" ? (
								<Ticker items={byNewest(MOCK_ANNOUNCEMENTS)} />
							) : null}
							{direction === "receipts" ? (
								<Receipts items={MOCK_ANNOUNCEMENTS} />
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

			{/* ============ 横幅展示方向：banner 形态四候选 ============ */}
			<section>
				<h2 className="mb-2 text-2xl font-semibold">横幅展示方向</h2>
				<p className="mb-8 max-w-3xl text-sm text-muted-foreground">
					banner 形态（display=banner）渲染在全站顶部横幅条。棱柱旋转为正交 3D 滚筒，
					与渐隐轮换、滑轨推入、电传打字四个候选并排比选。三条不变约束在所有方向上保持：后端排序不重排、
					关闭即标记已读、动画可暂停（hover / 滚轮手动翻，reduced-motion 降级）。
				</p>

				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<Segmented
						value={banner}
						onValueChange={setBanner}
						segments={BANNER_DIRECTIONS.map((d) => ({
							value: d.value,
							label: d.label,
						}))}
						size="default"
					/>
				</div>

				<p className="mb-6 font-mono text-xs text-muted-foreground">
					<span className="mr-2 tracking-[0.3em] text-muted-foreground/60 uppercase">
						Intent
					</span>
					{activeBanner.intent}
				</p>

				{/* 横幅预览：条体贴预览框顶部，下方是页面语境占位 */}
				<div className="overflow-hidden rounded-2xl border border-edge-hairline bg-background/40">
					<p className="border-b border-edge-hairline px-6 py-3 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase md:px-10">
						Preview · violet.blog 页顶 · {activeBanner.label}
					</p>

					{banner === "prism" ? <BannerPrism items={MOCK_BANNERS} /> : null}
					{banner === "crossfade" ? <BannerCrossfade items={MOCK_BANNERS} /> : null}
					{banner === "slide" ? <BannerSlide items={MOCK_BANNERS} /> : null}
					{banner === "teletype" ? <BannerTeletype items={MOCK_BANNERS} /> : null}

					<div className="flex h-56 items-center justify-center">
						<p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/40 uppercase">
							页面内容 · 示意
						</p>
					</div>
				</div>
			</section>
		</div>
	);
}

export const Route = createFileRoute("/lab/announcement")({
	component: AnnouncementLab,
});
