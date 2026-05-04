// 表情系统 Hook
// 获取表情分组和表情，支持搜索和显示内容获取
// 使用 React Query 实现全局单例，只请求一次

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getUploadUrl } from "@/lib/api";
import type { EmojiGroup, EmojisResponse } from "@/types/emoji";

// 统一的表情项接口（用于选择器展示）
export interface EmojiItem {
  id: number;
  name: string;
  // 显示内容：图片URL 或文本
  display: string;
  // 插入语法 [表情名]
  syntax: string;
  // 来源类型
  source: EmojiGroup["source"];
}

interface UseEmojisResult {
  // 所有表情分组
  groups: EmojiGroup[];
  // 加载状态
  loading: boolean;
  // 错误信息
  error: string | null;
  // 搜索功能：跨所有表情搜索
  search: (query: string) => EmojiItem[];
  // 根据语法 `[表情名]` 获取显示内容
  getDisplayByName: (name: string) => string | null;
  // 刷新表情数据
  refresh: () => Promise<void>;
}

// 构建表情名称到显示内容的映射
function buildEmojiMap(groups: EmojiGroup[]): Map<string, string> {
  const map = new Map<string, string>();
  groups.forEach((group) => {
    (group.emojis || []).forEach((emoji) => {
      const display = emoji.url
        ? getUploadUrl(emoji.url)
        : emoji.text_content || emoji.name;
      map.set(emoji.name, display);
    });
  });
  return map;
}

export function useEmojis(): UseEmojisResult {
  // 使用 React Query 实现全局单例
  // staleTime: Infinity 表示数据永不过期，只请求一次
  const {
    data: groups = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["emojis"],
    queryFn: async () => {
      const response = await api.get<EmojisResponse>("/emojis");
      return response.groups || [];
    },
    staleTime: Infinity, // 数据永不过期
    gcTime: 1000 * 60 * 60 * 24, // 缓存 24 小时
    refetchOnWindowFocus: false, // 窗口聚焦时不重新请求
    refetchOnMount: false, // 组件挂载时不重新请求
  });

  const error = queryError ? "加载表情失败" : null;

  // 构建表情名称映射（使用 useMemo 缓存）
  const emojiMap = useMemo(() => buildEmojiMap(groups), [groups]);

  // 预计算所有 EmojiItem 对象（使用 useMemo 缓存）
  // 这样 getUploadUrl 只在 groups 变化时调用一次
  const allEmojiItems = useMemo(() => {
    const items: EmojiItem[] = [];
    groups.forEach((group) => {
      (group.emojis || []).forEach((emoji) => {
        items.push({
          id: emoji.id,
          name: emoji.name,
          display: emoji.url
            ? getUploadUrl(emoji.url)
            : emoji.text_content || emoji.name,
          syntax: `[${emoji.name}]`,
          source: group.source,
        });
      });
    });
    return items;
  }, [groups]);

  // 搜索功能：跨所有表情搜索
  // 使用预计算的 allEmojiItems，避免重复调用 getUploadUrl
  const search = useCallback(
    (query: string): EmojiItem[] => {
      if (!query.trim()) return [];

      const lowerQuery = query.toLowerCase();
      return allEmojiItems.filter((item) =>
        item.name.toLowerCase().includes(lowerQuery)
      );
    },
    [allEmojiItems]
  );

  // 根据表情名获取显示内容
  const getDisplayByName = useCallback(
    (name: string): string | null => {
      return emojiMap.get(name) || null;
    },
    [emojiMap]
  );

  // 刷新函数
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    groups,
    loading,
    error,
    search,
    getDisplayByName,
    refresh,
  };
}
