/**
 * useFloatingMathPanel - 公式编辑浮层定位
 *
 * 用 @floating-ui/dom 做定位，absolute 策略：
 * 浮层渲染在编辑器 DOM 内，受滚动容器 overflow 裁剪——跟随公式滚动，
 * 滚出可视区即被裁剪，不覆盖页面/工具栏。下方空间不足时 flip 翻转到上方。
 *
 * 不用 Radix Popover 的定位层：它硬编码 strategy:fixed（相对视口），
 * fixed 不受父容器 overflow 裁剪，弹层会飘出编辑器覆盖整页。
 */
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { Editor } from "@tiptap/react";
import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface FloatingPosition {
    top: number;
    left: number;
}

/** 编辑器滚动容器缓存（跨公式实例共享，避免重复 DOM 遍历） */
let cachedScroller: HTMLElement | null = null;

function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
    if (cachedScroller && document.contains(cachedScroller)) return cachedScroller;
    let node = el?.parentElement;
    while (node) {
        const cs = getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) {
            cachedScroller = node;
            return node;
        }
        node = node.parentElement;
    }
    return null;
}

/**
 * 计算浮层相对编辑器滚动容器的 absolute 定位。
 * anchor/panel 用 RefObject 传入：useLayoutEffect 在 commit 后运行，
 * 此时 ref.current 已赋值，能拿到真实 DOM 测量。
 */
export function useFloatingMathPanel(
    open: boolean,
    anchorRef: RefObject<HTMLElement | null>,
    panelRef: RefObject<HTMLElement | null>,
    editor: Editor,
) {
    const [position, setPosition] = useState<FloatingPosition | null>(null);
    const frameRef = useRef(0);

    const update = () => {
        const anchorEl = anchorRef.current;
        const panelEl = panelRef.current;
        if (!open || !anchorEl || !panelEl) return;
        const scroller = findScrollContainer(editor.view.dom);
        if (!scroller) return;
        void computePosition(anchorEl, panelEl, {
            strategy: "absolute",
            placement: "bottom",
            middleware: [
                offset(6),
                flip({ boundary: scroller }),
                shift({ padding: 8, boundary: scroller }),
            ],
        }).then(({ x, y }) => {
            // 相等守卫：坐标未变时复用旧对象，避免新对象 identity 触发重渲染，
            // 打断「渲染 → 重定位 → setState → 渲染」失控循环
            setPosition((prev) =>
                prev && prev.top === y && prev.left === x ? prev : { top: y, left: x },
            );
        });
    };

    // 仅在 open/editor 变化时重定位：滚动与 resize 由下方 effect 的 trigger 处理；
    // 无依赖数组会让 setPosition 引发的重渲染再次触发 update，形成失控循环
    // biome-ignore lint/correctness/useExhaustiveDependencies: update 闭包捕获 ref，依赖 [open,editor] 足够触发重绑
    useLayoutEffect(() => {
        update();
    }, [open, editor]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: update 闭包捕获 ref，依赖 [open,editor] 足够触发重绑
    useEffect(() => {
        if (!open) return;
        const scroller = findScrollContainer(editor.view.dom);
        const trigger = () => {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = requestAnimationFrame(update);
        };
        scroller?.addEventListener("scroll", trigger, { passive: true });
        window.addEventListener("resize", trigger);
        return () => {
            scroller?.removeEventListener("scroll", trigger);
            window.removeEventListener("resize", trigger);
            cancelAnimationFrame(frameRef.current);
        };
    }, [open, editor]);

    return position;
}
