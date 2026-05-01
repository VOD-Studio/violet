// 磁性按钮组件
// 鼠标靠近时按钮被"吸引"向鼠标方向移动，离开时弹回原位

import { type ReactNode, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  type SpringOptions,
} from "motion/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface MagneticButtonProps {
  /** 子元素 */
  children: ReactNode;
  /** 吸引强度，值越大吸引越明显，默认 0.35 */
  strength?: number;
  /** 弹簧动画配置 */
  springConfig?: SpringOptions;
  /** 额外的 CSS 类名 */
  className?: string;
}

/**
 * 磁性按钮组件
 * 鼠标靠近时元素会向鼠标方向偏移，产生磁铁吸附效果
 */
export function MagneticButton({
  children,
  strength = 0.35,
  springConfig = { damping: 15, stiffness: 150 },
  className,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  /** 鼠标在元素上移动时，根据偏移量计算吸引位移 */
  function handleMouseMove(e: React.MouseEvent) {
    if (prefersReduced) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * strength);
    y.set((e.clientY - centerY) * strength);
  }

  /** 鼠标离开时重置位置 */
  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  // 减少动画偏好下直接渲染普通元素
  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  );
}
