/**
 * useMathAnchor - 公式节点弹层的虚拟锚点
 *
 * 锚点用 view.nodeDOM(pos) 取节点真实 DOM 的 rect。块级 atom 节点也有
 * 完整尺寸（高度 = 公式渲染高度），弹层经 side="bottom" 落在公式下方。
 *
 * 不用 coordsAtPos(pos)：它对块级 atom 节点返回零高度缝隙（top==bottom，
 * 定位在节点顶部），会让 Radix 把弹层放在公式顶部、覆盖整个公式。
 * coordsAtPos 仅在 nodeDOM 取不到时作回退（行内节点边界等异常情况）。
 *
 * 身份稳定的虚拟锚点 + 浮层 updatePositionStrategy:"always"：文档滚动/编辑
 * 导致公式移动时，Radix 每次重新调 getBoundingClientRect，浮层实时跟随。
 */
import type { Editor, NodeViewProps } from "@tiptap/react";
import { useRef } from "react";

type Measurable = { getBoundingClientRect: () => DOMRect };

export function useMathAnchor(getPos: NodeViewProps["getPos"], editor: Editor) {
    const latest = useRef({ getPos, editor });
    latest.current = { getPos, editor };
    const anchor = useRef<Measurable>({
        getBoundingClientRect: () => {
            const { getPos: gp, editor: ed } = latest.current;
            const pos = typeof gp === "function" ? gp() : null;
            if (typeof pos !== "number") return new DOMRect();
            const dom = ed.view.nodeDOM(pos) as HTMLElement | null;
            if (dom && typeof dom.getBoundingClientRect === "function") {
                return dom.getBoundingClientRect();
            }
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
