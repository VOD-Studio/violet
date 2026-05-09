import { useRef, useState, useEffect, type ReactNode } from "react";

/** TextMarquee 组件的属性 */
interface TextMarqueeProps {
  /** 文本内容 */
  children: ReactNode;
  /** 滚动速度 */
  speed?: number;
  /** 自定义类名 */
  className?: string;
}

export function TextMarquee({ children, speed = 30, className }: TextMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (container && inner) {
      setShouldScroll(inner.scrollWidth > container.clientWidth);
    }
  }, [children]);

  if (!shouldScroll) {
    return (
      <div ref={containerRef} className={`overflow-hidden ${className ?? ""}`}>
        <span ref={innerRef}>{children}</span>
      </div>
    );
  }

  const duration = (innerRef.current?.scrollWidth ?? 100) / speed;

  return (
    <div ref={containerRef} className={`overflow-hidden ${className ?? ""}`}>
      <div
        className="flex whitespace-nowrap"
        style={{
          animation: `marquee-scroll ${duration}s linear infinite`,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = "running")}
      >
        <span ref={innerRef}>{children}</span>
        <span className="pl-4">{children}</span>
      </div>
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-${innerRef.current?.scrollWidth ?? 0}px); }
        }
      `}</style>
    </div>
  );
}
