import { Play } from "lucide-react";
import type { MockItem } from "../model/mock";
import { VideoBadge } from "./FeedVariants";

/**
 * 详情网格方向 A · 等高行（Google Photos justified）
 *
 * 每行统一行高、按宽高比分配列宽——横竖混排最自然的相册形态，
 * 无裁切、密度均匀，代价是布局需按行聚合计算。
 */
export function GridJustified({
	items,
	onOpen,
}: {
	items: MockItem[];
	onOpen: (i: number) => void;
}) {
	const rows = justifyRows(items, 3.2); // 目标行宽比（宽/高），越大队越疏
	return (
		<div className="space-y-2">
			{rows.map((row, ri) => {
				const height = 100 / (row.reduce((s, it) => s + it.ratio, 0) / row.length);
				return (
					<div key={ri} className="flex gap-2">
						{row.map((it) => {
							const idx = items.indexOf(it);
							return (
								<button
									key={it.id}
									type="button"
									onClick={() => onOpen(idx)}
									className="group relative overflow-hidden rounded-md"
									style={{
										width: `${height * it.ratio}px`,
										height: `${height}px`,
									}}
								>
									<img
										src={it.url}
										alt={it.caption ?? ""}
										loading="lazy"
										className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
									/>
									{it.isVideo ? <VideoBadge /> : null}
								</button>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}

/** 按目标行宽贪心聚合行（justified 布局的经典算法）。 */
function justifyRows(items: MockItem[], targetRatio: number): MockItem[][] {
	const rows: MockItem[][] = [];
	let current: MockItem[] = [];
	let sum = 0;
	for (const it of items) {
		current.push(it);
		sum += it.ratio;
		if (sum >= targetRatio) {
			rows.push(current);
			current = [];
			sum = 0;
		}
	}
	if (current.length > 0) rows.push(current);
	return rows;
}

/**
 * 详情网格方向 B · 瀑布流（Masonry/Pinterest）
 *
 * 等宽多列、每项保持完整宽高比纵向堆叠——图片不裁切、实现最简，
 * 代价是行参差、扫读节奏碎。
 */
export function GridMasonry({ items, onOpen }: { items: MockItem[]; onOpen: (i: number) => void }) {
	const cols = 3;
	const columns: MockItem[][] = Array.from({ length: cols }, () => []);
	for (const [i, it] of items.entries()) {
		columns[i % cols].push(it);
	}
	return (
		<div className="grid grid-cols-3 gap-2">
			{columns.map((col, ci) => (
				<div key={ci} className="flex flex-col gap-2">
					{col.map((it) => {
						const idx = items.indexOf(it);
						return (
							<button
								key={it.id}
								type="button"
								onClick={() => onOpen(idx)}
								className="group relative overflow-hidden rounded-md"
							>
								<img
									src={it.url}
									alt={it.caption ?? ""}
									loading="lazy"
									style={{ aspectRatio: `${it.ratio}` }}
									className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
								/>
								{it.isVideo ? <VideoBadge /> : null}
							</button>
						);
					})}
				</div>
			))}
		</div>
	);
}

/**
 * 详情网格方向 C · 等宽网格
 *
 * 统一方格、统一裁切——秩序感最强、缩略图最密，代价是竖图被裁。
 * 适合封面质量统一的图集。
 */
export function GridUniform({ items, onOpen }: { items: MockItem[]; onOpen: (i: number) => void }) {
	return (
		<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
			{items.map((it, i) => (
				<button
					key={it.id}
					type="button"
					onClick={() => onOpen(i)}
					className="group relative aspect-square overflow-hidden rounded-md"
				>
					<img
						src={it.url}
						alt={it.caption ?? ""}
						loading="lazy"
						className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
					/>
					{it.isVideo ? (
						<span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-sm bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white">
							<Play className="size-2.5" />
							视频
						</span>
					) : null}
				</button>
			))}
		</div>
	);
}
