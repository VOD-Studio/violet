import { useCallback, useMemo, useRef } from "react";
import { RelationLayer, type RelationLayerProps } from "./relation-layer.tsx";
import { type RelationGeometryOptions, useRelationGeometry } from "./use-relation-geometry.ts";

interface BoardRelationLayerProps extends Omit<RelationLayerProps, "rects" | "lanes" | "ref"> {
	geometry: Omit<RelationGeometryOptions, "ids" | "scrollerRef">;
}

/** 关系线的逐帧几何状态只由叠加层消费，不使卡片内容重新渲染。 */
export function BoardRelationLayer({
	relations,
	types,
	selectedId,
	cardLabel,
	geometry,
}: BoardRelationLayerProps) {
	const scrollerRef = useRef<HTMLElement | null>(null);
	const attach = useCallback((node: SVGSVGElement | null) => {
		// SVG 的 ref 先于本层 layout effect 就绪，不能等待外层容器的 ref。
		scrollerRef.current = node?.parentElement ?? null;
	}, []);
	const ids = useMemo(
		() => [...new Set(relations.flatMap((relation) => [relation.sourceId, relation.targetId]))],
		[relations],
	);
	const rects = useRelationGeometry({ ...geometry, scrollerRef, ids });
	return (
		<RelationLayer
			ref={attach}
			relations={relations}
			rects={rects}
			types={types}
			selectedId={selectedId}
			cardLabel={cardLabel}
			lanes
		/>
	);
}
