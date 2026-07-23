/**
 * useMathAnchor - 公式节点弹层的虚拟锚点
 *
 * 锚点用 view.nodeDOM(pos) 取节点真实 DOM 的 rect，并 clamp 到编辑器滚动
 * 容器的可见边界。公式滚出视口时锚点固定在容器顶部，弹层 sticky 到编辑区
 * 顶部——不飘出覆盖页面（Portal fixed 定位的固有问题，clamp 锚点规避）。
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

/** 从给定元素向上找第一个可纵向滚动的祖先（overflowY auto/scroll 且内容溢出） */
function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
    let node = el?.parentElement;
    while (node) {
        const cs = getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) {
            return node;
        }
        node = node.parentElement;
    }
    return null;
}

export function useMathAnchor(getPos: NodeViewProps["getPos"], editor: Editor) {
    const latest = useRef({ getPos, editor });
    latest.current = { getPos, editor };
    const anchor = useRef<Measurable>({
        getBoundingClientRect: () => {
            const { getPos: gp, editor: ed } = latest.current;
            const pos = typeof gp === "function" ? gp() : null;
            if (typeof pos !== "number") return new DOMRect();

            let rect: DOMRect;
            const dom = ed.view.nodeDOM(pos) as HTMLElement | null;
            if (dom && typeof dom.getBoundingClientRect === "function") {
                rect = dom.getBoundingClientRect();
            } else {
                const { left, right, top, bottom } = ed.view.coordsAtPos(pos);
                rect = DOMRect.fromRect({
                    x: left,
                    y: top,
                    width: Math.max(right - left, 1),
                    height: bottom - top,
                });
            }

            // Clamp 到滚动容器可见范围：公式滚出视口时锚点固定在容器边缘，
            // 弹层 sticky 到编辑区内，不飘出覆盖页面。
            const scroller = findScrollContainer(ed.view.dom);
            if (scroller) {
                const sr = scroller.getBoundingClientRect();
                const pad = 8;
                rect = DOMRect.fromRect({
                    x: rect.left,
                    y: Math.max(sr.top + pad, Math.min(rect.top, sr.bottom - pad)),
                    width: Math.max(rect.width, 1),
                    height: Math.max(rect.height, 1),
                });
            }
            return rect;
        },
    });
    return anchor;
}
