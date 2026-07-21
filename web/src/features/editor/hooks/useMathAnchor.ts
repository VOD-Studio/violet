/**
 * useMathAnchor - 公式节点弹层的虚拟锚点
 *
 * 锚点不走 DOM ref（NodeViewWrapper 不可外包元素），每次测量都经
 * coordsAtPos 取当前位置的视口坐标；配合浮层 updatePositionStrategy:"always"，
 * 文档滚动/编辑导致公式移动时浮层实时跟随。
 */
import type { Editor, NodeViewProps } from "@tiptap/react";
import { useRef } from "react";

type Measurable = { getBoundingClientRect: () => DOMRect };

export function useMathAnchor(getPos: NodeViewProps["getPos"], editor: Editor) {
    const latest = useRef({ getPos, editor });
    latest.current = { getPos, editor };
    // 身份稳定的虚拟锚点：身份不变，Radix 每次测量都重新调 getBoundingClientRect
    const anchor = useRef<Measurable>({
        getBoundingClientRect: () => {
            const { getPos: gp, editor: ed } = latest.current;
            const pos = typeof gp === "function" ? gp() : null;
            if (typeof pos !== "number") return new DOMRect();
            const { left, right, top, bottom } = ed.view.coordsAtPos(pos);
            return DOMRect.fromRect({
                x: left,
                y: top,
                width: Math.max(right - left, 1),
                height: bottom - top,
            });
        },
    });
    return anchor;
}
