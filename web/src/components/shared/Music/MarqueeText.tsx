/**
 * 溢出时自动滚动的文字组件
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MarqueeTextProps {
  children: string;
  className?: string;
}

export function MarqueeText({ children, className }: MarqueeTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollWidth > el.clientWidth);
  }, [children]);

  if (!overflow) {
    return (
      <span ref={ref} className={cn("truncate block", className)}>
        {children}
      </span>
    );
  }

  return (
    <span className="block overflow-hidden" aria-label={children}>
      <span ref={ref} className={cn("marquee-text", className)}>
        {children}&emsp;{children}&emsp;
      </span>
    </span>
  );
}
