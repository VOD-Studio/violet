import { MOCK_FRIEND_LINKS } from "@features/lab/friends/model/mock";
import { ApplyDialog } from "@features/lab/friends/ui/ApplyDialog";
import { CardWall } from "@features/lab/friends/ui/CardWall";
import { FriendsSkeleton, type LabDirection } from "@features/lab/friends/ui/FriendsSkeleton";
import { PostcardWall } from "@features/lab/friends/ui/PostcardWall";
import { TerminalList } from "@features/lab/friends/ui/TerminalList";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { useState } from "react";

type PreviewState = "data" | "skeleton" | "empty";

const DIRECTIONS: { value: LabDirection; label: string; intent: string }[] = [
	{
		value: "cards",
		label: "名片墙",
		intent: "把「互换链接」直译为「交换名片」：横版名片 + № 序号，hover 时名片被拿起（边缘冷光 + 箭头滑入），最贴全站语言。",
	},
	{
		value: "postcards",
		label: "明信片墙",
		intent: "友链是远方朋友寄来的明信片：头像是邮票（虚线齿孔），EXCHANGED 邮戳标记互换事实，微旋转错落排布，编辑感最强。",
	},
	{
		value: "terminal",
		label: "终端清单",
		intent: "$ ls --friends 的 mono 目录学：每条友链一行记录，hover 行内展开站长与描述，与全站终端 DNA 同源，最极客。",
	},
];

/**
 * /lab/friends - 友链视觉原型实验室（F2 / issue #161）
 *
 * 静态 mock、不接 API：三个候选展示方向可切换对比，附数据/骨架/空三态预览，
 * 以及「交换名片」申请弹窗的交互仪式原型。目验收选定方向后，
 * 生产实现（F3 /friends）按选定方向落地。
 */
function FriendsLab() {
	const [direction, setDirection] = useState<LabDirection>("cards");
	const [preview, setPreview] = useState<PreviewState>("data");
	const [applyOpen, setApplyOpen] = useState(false);

	const active = DIRECTIONS.find((d) => d.value === direction) ?? DIRECTIONS[0];

	return (
		<div className="container mx-auto px-6 py-24">
			<div className="mb-16 text-center">
				<Link
					to="/lab"
					className="mb-6 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase transition-colors hover:text-foreground"
				>
					<ArrowLeft className="size-3.5" />
					Labs
				</Link>
				<h1 className="mb-4 text-4xl font-bold tracking-tight">友链原型实验室</h1>
				<p className="mx-auto max-w-xl text-muted-foreground">
					友链页（/friends）的候选视觉方向对比，静态 mock 数据，不接
					API。选定方向后，正式页面按此实现。
				</p>
			</div>

			{/* ============ 展示态：方向对比 ============ */}
			<section className="mb-24">
				<h2 className="mb-2 text-2xl font-semibold">展示态方向</h2>
				<p className="mb-8 text-sm text-muted-foreground">
					同一组 mock 友链（10 条，含头像/描述/站长为 null 的样本）在三个方向下的渲染。
					右侧可切换数据 / 骨架屏 / 空态。
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
					<span className="mr-2 uppercase tracking-[0.3em] text-muted-foreground/60">
						Intent
					</span>
					{active.intent}
				</p>

				{/* 近生产预览框：页头语言对齐全站内容页 */}
				<div className="rounded-2xl border border-edge-hairline bg-background/40 p-6 md:p-10">
					<p className="mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
						Preview · violet.blog/friends · {active.label}
					</p>

					<header className="mb-10 flex flex-wrap items-end justify-between gap-4">
						<div>
							<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
								Friends
							</p>
							<h3 className="font-mono text-4xl font-bold">友链</h3>
						</div>
						<Button variant="outline" onClick={() => setApplyOpen(true)}>
							<Plus className="size-4" />
							申请友链
						</Button>
					</header>

					{preview === "data" ? (
						<div key={direction}>
							{direction === "cards" ? <CardWall links={MOCK_FRIEND_LINKS} /> : null}
							{direction === "postcards" ? (
								<PostcardWall links={MOCK_FRIEND_LINKS} />
							) : null}
							{direction === "terminal" ? (
								<TerminalList links={MOCK_FRIEND_LINKS} />
							) : null}
						</div>
					) : null}

					{preview === "skeleton" ? (
						<FriendsSkeleton key={`sk-${direction}`} direction={direction} />
					) : null}

					{preview === "empty" ? (
						<Empty
							key={`empty-${direction}`}
							size="lg"
							title="NO LINKS YET"
							description="还没有互换任何友链。递出你的名片，成为第一个。"
							action={
								<Button onClick={() => setApplyOpen(true)}>
									递出第一张名片
									<ArrowRight className="size-4" />
								</Button>
							}
							className="py-16"
						/>
					) : null}
				</div>
			</section>

			{/* ============ 申请弹窗：交换名片仪式 ============ */}
			<section>
				<h2 className="mb-2 text-2xl font-semibold">申请弹窗 · 交换名片</h2>
				<p className="mb-8 max-w-2xl text-sm text-muted-foreground">
					申请友链被设计成一次「交换名片」的仪式：左栏是随填写实时成形的名片，
					匿名轨道先验明正身（邮箱 → 验证码），登录轨道直达名片； 提交瞬间名片翻面、 盖上
					PENDING 邮戳并给出回执编号——高潮是「名片已递出」，不是「表单提交成功」。
				</p>
				<Button size="lg" onClick={() => setApplyOpen(true)}>
					<Plus className="size-4" />
					打开交换名片弹窗
				</Button>
			</section>

			<ApplyDialog open={applyOpen} onOpenChange={setApplyOpen} />
		</div>
	);
}

export const Route = createFileRoute("/lab/friends")({
	component: FriendsLab,
});
