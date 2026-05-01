import { useState, useEffect, useCallback, useRef } from "react";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface UseTocOptions {
  minLevel?: number;
  maxLevel?: number;
  offsetTop?: number;
}

export function useToc({
  minLevel = 2,
  maxLevel = 4,
  offsetTop = 88,
}: UseTocOptions = {}) {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // headings 始终通过 ref 暴露给 scroll handler，
  // 彻底斩断 scroll effect 对 headings state 的依赖，根绝循环。
  const headingsRef = useRef<TocItem[]>([]);

  // ── Effect 1：提取标题（只在选项变化时重跑）──────────────────
  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout>;

    const extract = (retries = 0) => {
      if (cancelled) return;

      const prose = document.querySelector(".prose");
      if (!prose) {
        if (retries < 8) timerId = setTimeout(() => extract(retries + 1), 250);
        return;
      }

      const els = prose.querySelectorAll<HTMLElement>("h2,h3,h4,h5,h6");
      const items: TocItem[] = [];

      els.forEach((el) => {
        const level = parseInt(el.tagName[1], 10);
        if (level < minLevel || level > maxLevel) return;
        // 使用已存在的 ID
        if (!el.id) return;
        el.style.scrollMarginTop = `${offsetTop}px`;
        items.push({ id: el.id, text: el.textContent?.trim() ?? "", level });
      });

      if (cancelled) return;

      // 只在内容真正变化时更新，避免 Strict Mode 二次执行产生新引用
      const ids = items.map((h) => h.id).join(",");
      const prevIds = headingsRef.current.map((h) => h.id).join(",");
      if (ids === prevIds) return;

      headingsRef.current = items;
      setHeadings(items);
      if (items.length > 0) setActiveId(items[0].id);
    };

    extract();

    return () => {
      // 清理：防止组件卸载后 retry 的 setHeadings 仍然执行（Strict Mode 必须）
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [minLevel, maxLevel, offsetTop]);

  // ── Effect 2：滚动追踪激活标题 ────────────────────────────────
  // 依赖只有 offsetTop（基本不变）。
  // headings 通过 headingsRef 读取 → 永远是最新值，没有 stale closure，
  // 也不会因为 headings 引用变化而反复重建监听器。
  useEffect(() => {
    const onScroll = () => {
      const current = headingsRef.current;
      if (current.length === 0) return;

      let activeIdx = 0;
      for (let i = 0; i < current.length; i++) {
        const top = document
          .getElementById(current[i].id)
          ?.getBoundingClientRect().top;
        if (top !== undefined && top <= offsetTop + 4) activeIdx = i;
      }

      // 用函数式更新，只在真正变化时触发渲染
      setActiveId((prev) => {
        const next = current[activeIdx].id;
        return next === prev ? prev : next;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // 初始化一次，定位当前激活项
    return () => window.removeEventListener("scroll", onScroll);
  }, [offsetTop]); // ← 不依赖 headings，根绝循环

  // ── 点击跳转 ──────────────────────────────────────────────────
  const scrollTo = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - offsetTop;
      window.scrollTo({ top, behavior: "smooth" });
    },
    [offsetTop]
  );

  return { headings, activeId, scrollTo };
}
