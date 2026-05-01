// 光标跟随效果组件
// 自定义光标样式，跟随鼠标移动并带有延迟，hover 链接时放大

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface CursorEffectProps {
  /** 光标默认尺寸，默认 12 */
  size?: number;
  /** hover 时的放大尺寸，默认 48 */
  hoverSize?: number;
  /** 光标颜色，默认 rgba(100, 100, 100, 0.4) */
  color?: string;
  /** 弹簧动画阻尼，默认 25 */
  damping?: number;
}

/**
 * 光标跟随效果组件
 * 桌面端显示自定义光标，鼠标悬停在可点击元素上时放大
 * 移动端和减少动画偏好下自动隐藏
 */
export function CursorEffect({
  size = 12,
  hoverSize = 48,
  color = "rgba(100, 100, 100, 0.4)",
  damping = 25,
}: CursorEffectProps) {
  const prefersReduced = useReducedMotion();
  const isHovering = useRef(false);

  // 使用 motion value 跟踪鼠标位置
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // 弹性平滑跟随
  const springX = useSpring(mouseX, { damping, stiffness: 300 });
  const springY = useSpring(mouseY, { damping, stiffness: 300 });

  const sizeValue = useMotionValue(size);
  const springSize = useSpring(sizeValue, { damping, stiffness: 300 });

  useEffect(() => {
    // 移动端或减少动画偏好下不初始化
    if (prefersReduced) return;
    if ("ontouchstart" in window) return;

    // 隐藏系统光标
    document.body.style.cursor = "none";

    function handleMouseMove(e: MouseEvent) {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    }

    // 检测是否悬停在可交互元素上
    function handleMouseOver(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.closest("a") ||
        target.closest("button") ||
        target.closest("[role='button']") ||
        target.closest("input") ||
        target.closest("textarea");
      if (isInteractive && !isHovering.current) {
        isHovering.current = true;
        sizeValue.set(hoverSize);
      }
    }

    function handleMouseOut(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.closest("a") ||
        target.closest("button") ||
        target.closest("[role='button']") ||
        target.closest("input") ||
        target.closest("textarea");
      if (isInteractive && isHovering.current) {
        isHovering.current = false;
        sizeValue.set(size);
      }
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);

    return () => {
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
    };
  }, [prefersReduced, hoverSize, size, mouseX, mouseY, sizeValue]);

  // 移动端或减少动画偏好下不渲染
  if (
    prefersReduced ||
    (typeof window !== "undefined" && "ontouchstart" in window)
  ) {
    return null;
  }

  return (
    <motion.div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        x: springX,
        y: springY,
        width: springSize,
        height: springSize,
        backgroundColor: color,
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 9999,
        // 通过 translate 居中对齐
        translateX: "-50%",
        translateY: "-50%",
      }}
    />
  );
}
