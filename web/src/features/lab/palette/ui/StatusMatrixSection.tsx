import { STATUS_TOKENS } from "@features/lab/palette/model/tokens";
import { ColorSwatch } from "@features/lab/palette/ui/ColorSwatch";
import { cn } from "cn";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface StatusMatrixSectionProps {
	mode: "light" | "dark" | "dual";
	className?: string;
}

/**
 * StatusMatrixSection - 行为与反馈状态语义系统（Destructive / Warning / Success）。
 */
export function StatusMatrixSection({ mode, className }: StatusMatrixSectionProps) {
	return (
		<section className={cn("mb-16", className)}>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline pb-4">
				<div>
					<p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
						Semantic Invariants
					</p>
					<h3 className="mt-1 text-2xl font-bold tracking-tight">行为与状态语义调色板</h3>
				</div>
				<p className="max-w-md text-xs text-muted-foreground">
					状态语义色具有不可篡改性（Protected
					Invariant）。无论品牌方言或调色板如何更迭，红、黄、绿状态语义永不被覆写。
				</p>
			</div>

			{/* 状态卡片 */}
			{mode === "dual" ? (
				<div className="mb-8 space-y-6">
					<div>
						<h4 className="mb-3 font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							浅色模式状态色（白瓷画布基底）
						</h4>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							{STATUS_TOKENS.map((token) => (
								<ColorSwatch
									key={`light-${token.variable}`}
									token={token}
									mode="light"
								/>
							))}
						</div>
					</div>

					<div>
						<h4 className="mb-3 font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							深色模式状态色（玄曜星空基底）
						</h4>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							{STATUS_TOKENS.map((token) => (
								<ColorSwatch
									key={`dark-${token.variable}`}
									token={token}
									mode="dark"
								/>
							))}
						</div>
					</div>
				</div>
			) : (
				<div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
					{STATUS_TOKENS.map((token) => (
						<ColorSwatch key={token.variable} token={token} mode={mode} />
					))}
				</div>
			)}

			{/* 真实状态横幅模拟预览 */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{/* 错误 / 危险 */}
				<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs shadow-xs">
					<div className="flex items-center gap-2 font-semibold text-destructive">
						<AlertCircle className="size-4" />
						<span>危险操作拦截</span>
					</div>
					<p className="mt-1.5 leading-relaxed text-muted-foreground">
						删除文章将连同历史修订一并归档，操作不可撤销。
					</p>
				</div>

				{/* 警告 / 注意 */}
				<div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-xs shadow-xs">
					<div className="flex items-center gap-2 font-semibold text-warning">
						<AlertTriangle className="size-4" />
						<span>草稿未同步提醒</span>
					</div>
					<p className="mt-1.5 leading-relaxed text-muted-foreground">
						检测到本地与远端存在 2 处修订冲突，请核对后再发布。
					</p>
				</div>

				{/* 成功 / 达成 */}
				<div className="rounded-xl border border-success/20 bg-success/5 p-4 text-xs shadow-xs">
					<div className="flex items-center gap-2 font-semibold text-success">
						<CheckCircle2 className="size-4" />
						<span>修订发布成功</span>
					</div>
					<p className="mt-1.5 leading-relaxed text-muted-foreground">
						站点 RSS 源与静态缓存已于 12ms 内完成全量广播。
					</p>
				</div>
			</div>
		</section>
	);
}
