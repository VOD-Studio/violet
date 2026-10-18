import { arrowHead, blockerBar, type Rect, type Relation, routeEdge } from "../../core/index.ts";
import { type RelationTypeStyle, relationStyle } from "./types.ts";

/** 终点箭头的大小与挡条的长度（布局像素）。 */
const ARROW = 9;
const BAR = 16;

export interface RelationLayerProps {
	relations: readonly Relation[];
	/** 各卡片在滚动层内容坐标系里的矩形。 */
	rects: ReadonlyMap<string, Rect>;
	types: Readonly<Record<string, RelationTypeStyle>>;
	cardLabel(id: string): string;
}

/**
 * 关系线叠加层：一块 1×1 的 SVG 放在滚动层内容的左上角，线画在它的溢出区域里，
 * 所以随横向滚动，也随画布一起缩放平移。叠加层对读屏隐藏，文字等价由卡片上的关系描述提供。
 */
export function RelationLayer({ relations, rects, types, cardLabel }: RelationLayerProps) {
	return (
		<svg
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
			{relations.map((relation, index) => {
				const from = rects.get(relation.sourceId);
				const to = rects.get(relation.targetId);
				if (!from || !to) return null;
				const style = relationStyle(types, relation.type);
				const route = routeEdge(from, to);
				return (
					<g
						// 数据里可能有重复的关系，id 也可能带冒号：用位置当 key
						key={index}
						className="v-kanban__relation"
						data-relation-type={relation.type}
						data-line={style.line}
						data-source={relation.sourceId}
						data-target={relation.targetId}
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
