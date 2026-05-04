/**
 * 工具栏固定逻辑 Hook
 */

import { useEffect, useState, type RefObject } from "react";

interface UseStickyToolbarOptions {
  /** 容器引用 */
  containerRef: RefObject<HTMLDivElement | null>;
  /** 工具栏引用 */
  toolbarRef: RefObject<HTMLDivElement | null>;
}

/**
 * 工具栏固定逻辑 Hook
 * 监听滚动，当工具栏滚出容器时固定到视口顶部
 */
export function useStickyToolbar({
  containerRef,
  toolbarRef,
}: UseStickyToolbarOptions) {
  const [toolbarSticky, setToolbarSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || !toolbarRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const toolbarHeight = toolbarRef.current.offsetHeight;

      // 当容器顶部离开视口时，工具栏需要固定
      if (containerRect.top < -toolbarHeight) {
        setToolbarSticky(true);
      } else {
        setToolbarSticky(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [containerRef, toolbarRef]);

  return toolbarSticky;
}
