import { type MouseEvent, useCallback } from "react";

export interface MagneticInput {
    /** 鼠标相对视口坐标 */
    clientX: number;
    clientY: number;
    /** 元素中心点（视口坐标） */
    cx: number;
    cy: number;
    /** 吸附强度 0..1（1=完全贴住鼠标） */
    strength?: number;
}

export interface MagneticOffset {
    /** translate x（px） */
    dx: number;
    /** translate y（px） */
    dy: number;
}

/**
 * computeMagnetic - 计算磁性吸附位移（纯函数，便于测）
 *
 * 位移 = (鼠标 - 中心) * strength，鼠标越远偏移越大，
 * spec「靠近可点击元素产生轻微磁力吸附」。
 */
export function computeMagnetic(input: MagneticInput): MagneticOffset {
    const { clientX, clientY, cx, cy, strength = 0.25 } = input;
    return {
        dx: (clientX - cx) * strength,
        dy: (clientY - cy) * strength,
    };
}

/**
 * useMagnetic - 返回 onMouseMove/onMouseLeave 处理器，写 --mx/--my
 */
export function useMagnetic(strength = 0.25) {
    const onMouseMove = useCallback(
        (e: MouseEvent<HTMLElement>) => {
            const el = e.currentTarget;
            const r = el.getBoundingClientRect();
            const off = computeMagnetic({
                clientX: e.clientX,
                clientY: e.clientY,
                cx: r.left + r.width / 2,
                cy: r.top + r.height / 2,
                strength,
            });
            el.style.setProperty("--mx", `${off.dx}px`);
            el.style.setProperty("--my", `${off.dy}px`);
        },
        [strength],
    );
    const onMouseLeave = useCallback((e: MouseEvent<HTMLElement>) => {
        const el = e.currentTarget;
        el.style.setProperty("--mx", "0px");
        el.style.setProperty("--my", "0px");
    }, []);
    return { onMouseMove, onMouseLeave };
}
