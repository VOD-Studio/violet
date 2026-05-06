// 表情系统 Hook
// 获取表情分组，使用 React Query 实现全局单例

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getUploadUrl } from "@/lib/api";
import type { EmojiGroup, EmojisResponse, Emoji } from "@/types/emoji";

interface UseEmojisResult {
  groups: EmojiGroup[];
  loading: boolean;
  error: string | null;
  // 根据名称获取表情（用于评论渲染）
  getEmojiByName: (name: string) => Emoji | null;
  // 根据名称获取显示内容（用于评论渲染）
  getDisplayByName: (name: string) => string | null;
  refresh: () => Promise<void>;
}

export function useEmojis(): UseEmojisResult {
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
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const error = queryError ? "加载表情失败" : null;

  // 构建表情名称映射
  const emojiMap = new Map<string, Emoji>();
  const displayMap = new Map<string, string>();

  groups.forEach((group) => {
    (group.emojis || []).forEach((emoji) => {
      emojiMap.set(emoji.name, emoji);
      // 图片表情拼接域名，颜文字直接用文本
      const display = emoji.url
        ? getUploadUrl(emoji.url)
        : emoji.text_content || emoji.name;
      displayMap.set(emoji.name, display);
    });
  });

  const getEmojiByName = useCallback(
    (name: string): Emoji | null => emojiMap.get(name) || null,
    [groups]
  );

  const getDisplayByName = useCallback(
    (name: string): string | null => displayMap.get(name) || null,
    [groups]
  );

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    groups,
    loading,
    error,
    getEmojiByName,
    getDisplayByName,
    refresh,
  };
}