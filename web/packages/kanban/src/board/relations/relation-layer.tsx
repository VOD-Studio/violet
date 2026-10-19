import type { Ref } from "react";
import {
	arrowHead,
	assignLanes,
	blockerBar,
	type Rect,
	type Relation,
	routeEdge,
} from "../../core/index.ts";
import { type RelationTypeStyle, relationStyle } from "./types.ts";

/** 终点箭头的大小与挡条的长度（布局像素）。 */
const ARROW = 9;
const BAR = 16;

export interface RelationLayerProps {
	ref?: Ref<SVGSVGElement>;
	relations: readonly Relation[];
	/** 各卡片在滚动层内容坐标系里的矩形。 */
	rects: ReadonlyMap<string, Rect>;
	types: Readonly<Record<string, RelationTypeStyle>>;
	/** 选中的卡片；有选中时与它无关的线淡化。 */
	selectedId: string | null;
	cardLabel(id: string): string;
	/**
	 * 同一列里重叠的弧线分到不同车道、向外错开。路径限制在右缘外 15px，要有这么多空间才能用：
	 * 看板的列有内边距，够用；卡片紧贴边缘的布局不要开。
	 * @default false
	 */
	lanes?: boolean;
}

/**
 * 关系线叠加层：一块 1×1 的 SVG 放在滚动层内容的左上角，线画在它的溢出区域里，
 * 所以随横向滚动，也随画布一起缩放平移。叠加层对读屏隐藏，文字等价由卡片上的关系描述提供。
 */
export function RelationLayer({
	ref,
	relations,
	rects,
	types,
	selectedId,
	cardLabel,
	lanes = false,
}: RelationLayerProps) {
	const edges = relations.flatMap((relation, index) => {
		const from = rects.get(relation.sourceId);
		const to = rects.get(relation.targetId);
		return from && to ? [{ relation, index, from, to }] : [];
	});
	const laneOf = lanes ? assignLanes(edges) : [];
	return (
		<svg
			ref={ref}
			className="v-kanban__relations"
			width="1"
			height="1"
			aria-hidden="true"
			focusable="false"
			// 定位是功能性的，不依赖样式表：叠加层贴着滚动层内容的左上角，线画在溢出区域里
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				overflow: "visible",
				pointerEvents: "none",
			}}
		>
			{edges.map(({ relation, index, from, to }, position) => {
				const style = relationStyle(types, relation.type);
				const route = routeEdge(from, to, { lane: laneOf[position] });
				const state =
					selectedId === null
						? undefined
						: relation.sourceId === selectedId || relation.targetId === selectedId
							? "active"
							: "faded";
				return (
					<g
						// 数据里可能有重复的关系，id 也可能带冒号：用位置当 key
						key={index}
						className="v-kanban__relation"
						data-relation-type={relation.type}
						data-line={style.line}
						data-source={relation.sourceId}
						data-target={relation.targetId}
						data-state={state}
					>
						<title>{`${cardLabel(relation.sourceId)} ${style.label} ${cardLabel(relation.targetId)}`}</title>
						<path className="v-kanban__relation-line" d={route.d} />
						{style.line === "blocker" ? (
							<path
								className="v-kanban__relation-bar"
								d={blockerBar(route.end, route.angle, BAR)}
							/>
						) : (
							<path
								className="v-kanban__relation-head"
								d={arrowHead(route.end, route.angle, ARROW)}
							/>
						)}
					</g>
				);
			})}
		</svg>
	);
}
