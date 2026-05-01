// 通用无限滚动 Hook
// 使用 IntersectionObserver 检测滚动到底部，触发加载更多
// 可复用于媒体库、文章列表等需要分页加载的场景

import { useEffect, useRef, useCallback, useState } from "react";

/** 无限滚动配置 */
interface UseInfiniteScrollOptions {
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 是否正在加载中 */
  isLoading: boolean;
  /** 加载更多的回调函数 */
  onLoadMore: () => void;
  /** 触发加载的提前量（像素），默认 200 */
  rootMargin?: number;
  /** 滚动容器 ref，不传则监听视口 */
  rootRef?: React.RefObject<HTMLElement | null>;
  /** 是否启用，默认 true */
  enabled?: boolean;
}

/**
 * 通用无限滚动 Hook
 * 返回一个 ref 绑定到哨兵元素上，当该元素进入视口/容器时触发加载
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = 200,
  rootRef,
  enabled = true,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  /** 同步锁，防止 isLoading 异步更新期间重复触发 */
  const loadingRef = useRef(false);

  useEffect(() => {
    loadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          loadingRef.current = true;
          onLoadMore();
        }
      },
      { root: rootRef?.current ?? null, rootMargin: `${rootMargin}px` },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, rootMargin, rootRef, enabled]);

  return sentinelRef;
}

/** 分页数据状态 */
interface PaginatedState<T> {
  /** 所有已加载的数据 */
  items: T[];
  /** 当前页码 */
  page: number;
  /** 是否还有更多 */
  hasMore: boolean;
}

/**
 * 通用分页数据加载 Hook
 * 结合 react-query 的 useInfiniteQuery 实现分页加载
 *
 * @param queryKey - react-query 缓存键
 * @param fetchFn - 分页请求函数，接收 page 参数，返回 { items, total, page, limit }
 * @param limit - 每页数量
 */
export function usePaginatedQuery<T>(
  _queryKey: string[],
  fetchFn: (
    page: number,
    limit: number,
  ) => Promise<{ items: T[]; total: number; page: number; limit: number }>,
  limit: number = 20,
) {
  const [state, setState] = useState<PaginatedState<T>>({
    items: [],
    page: 1,
    hasMore: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 同步锁，防止并发请求 */
  const loadingRef = useRef(false);

  /** 加载指定页 */
  const loadPage = useCallback(
    async (page: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchFn(page, limit);
        setState((prev) => ({
          items: page === 1 ? result.items : [...prev.items, ...result.items],
          page,
          hasMore: result.items.length === limit && page * limit < result.total,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [fetchFn, limit],
  );

  /** 加载下一页 */
  const loadMore = useCallback(() => {
    if (!loadingRef.current && state.hasMore) {
      loadPage(state.page + 1);
    }
  }, [state.hasMore, state.page, loadPage]);

  /** 重新加载（从第一页开始） */
  const reload = useCallback(() => {
    setState({ items: [], page: 0, hasMore: true });
    loadingRef.current = false;
    loadPage(1);
  }, [loadPage]);

  // fetchFn 变化时重新加载（分类切换）
  const prevFetchRef = useRef(fetchFn);
  useEffect(() => {
    if (prevFetchRef.current !== fetchFn) {
      prevFetchRef.current = fetchFn;
      setState({ items: [], page: 0, hasMore: true });
      loadingRef.current = false;
      loadPage(1);
    }
  }, [fetchFn, loadPage]);

  // 首次加载
  useEffect(() => {
    loadPage(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    items: state.items,
    isLoading,
    error,
    hasMore: state.hasMore,
    loadMore,
    reload,
  };
}
