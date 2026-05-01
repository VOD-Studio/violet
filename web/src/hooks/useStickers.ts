import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getUploadUrl } from '@/lib/api';
import { emojiCategories, allEmojis, emojiMap } from '@/lib/emoji-data';
import { kaomojiCategories, allKaomojis, kaomojiMap } from '@/lib/kaomoji-data';
import type { StickerGroup, StickerGroupType } from '@/types/sticker';

// 统一的表情项接口
export interface StickerItem {
  id: string;
  name: string;
  // 显示内容：图片URL、emoji unicode 或颜文字文本
  display: string;
  // 插入语法
  syntax: string;
  // 类型
  type: StickerGroupType;
}

// 统一的表情分类接口
export interface StickerCategory {
  id: string;
  name: string;
  slug: string;
  type: StickerGroupType;
  iconUrl?: string;
  items: StickerItem[];
  isHot?: boolean;
  isOfficial?: boolean;
}

interface UseStickersResult {
  // 所有分类（包括自定义表情包、Emoji、颜文字）
  categories: StickerCategory[];
  // 加载状态
  loading: boolean;
  // 错误信息
  error: string | null;
  // 搜索
  search: (query: string) => StickerItem[];
  // 根据 shortcode 获取显示内容
  getDisplayBySyntax: (syntax: string) => string | null;
  // 刷新表情包数据
  refresh: () => Promise<void>;
}

// 将自定义表情包转换为统一格式
function transformCustomStickers(groups: StickerGroup[]): StickerCategory[] {
  return groups
    .filter(g => g.type === 'custom' && g.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(group => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      type: 'custom' as StickerGroupType,
      iconUrl: group.iconUrl,
      isHot: group.isHot,
      isOfficial: group.isOfficial,
      items: (group.stickers || [])
        .filter(s => s.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(sticker => ({
          id: sticker.id,
          name: sticker.name,
          display: getUploadUrl(sticker.imageUrl),
          syntax: `[sticker:${group.slug}/${sticker.slug}]`,
          type: 'custom' as StickerGroupType,
        })),
    }));
}

// 将 Emoji 分类转换为统一格式
function transformEmojiCategories(): StickerCategory[] {
  return emojiCategories.map(category => ({
    id: `emoji-${category.slug}`,
    name: category.name,
    slug: category.slug,
    type: 'emoji' as StickerGroupType,
    items: category.emojis.map(emoji => ({
      id: emoji.shortcode,
      name: emoji.name,
      display: emoji.unicode,
      syntax: `:${emoji.shortcode}:`,
      type: 'emoji' as StickerGroupType,
    })),
  }));
}

// 将颜文字分类转换为统一格式
function transformKaomojiCategories(): StickerCategory[] {
  return kaomojiCategories.map(category => ({
    id: `kaomoji-${category.slug}`,
    name: category.name,
    slug: category.slug,
    type: 'kaomoji' as StickerGroupType,
    items: category.kaomojis.map(kaomoji => ({
      id: kaomoji.shortcode,
      name: kaomoji.name,
      display: kaomoji.text,
      syntax: `:${kaomoji.shortcode}:`,
      type: 'kaomoji' as StickerGroupType,
    })),
  }));
}

export function useStickers(): UseStickersResult {
  const [customCategories, setCustomCategories] = useState<StickerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取自定义表情包
  const fetchCustomStickers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<{ groups: StickerGroup[] }>('/stickers');
      const categories = transformCustomStickers(response.groups);
      setCustomCategories(categories);
    } catch (err) {
      console.error('Failed to fetch stickers:', err);
      setError('加载表情包失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    fetchCustomStickers();
  }, [fetchCustomStickers]);

  // 合并所有分类：自定义表情包 + Emoji + 颜文字
  const categories: StickerCategory[] = [
    ...customCategories,
    ...transformEmojiCategories(),
    ...transformKaomojiCategories(),
  ];

  // 搜索功能：搜索所有表情项
  const search = useCallback((query: string): StickerItem[] => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const results: StickerItem[] = [];

    // 搜索自定义表情包
    customCategories.forEach(category => {
      category.items.forEach(item => {
        if (item.name.toLowerCase().includes(lowerQuery)) {
          results.push(item);
        }
      });
    });

    // 搜索 Emoji
    allEmojis.forEach(emoji => {
      if (
        emoji.name.toLowerCase().includes(lowerQuery) ||
        emoji.shortcode.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: emoji.shortcode,
          name: emoji.name,
          display: emoji.unicode,
          syntax: `:${emoji.shortcode}:`,
          type: 'emoji',
        });
      }
    });

    // 搜索颜文字
    allKaomojis.forEach(kaomoji => {
      if (
        kaomoji.name.toLowerCase().includes(lowerQuery) ||
        kaomoji.shortcode.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: kaomoji.shortcode,
          name: kaomoji.name,
          display: kaomoji.text,
          syntax: `:${kaomoji.shortcode}:`,
          type: 'kaomoji',
        });
      }
    });

    return results;
  }, [customCategories]);

  // 根据 syntax 获取显示内容
  const getDisplayBySyntax = useCallback((syntax: string): string | null => {
    // 自定义表情包: [sticker:groupSlug/stickerSlug]
    if (syntax.startsWith('[sticker:')) {
      const match = syntax.match(/\[sticker:([^/]+)\/([^\]]+)\]/);
      if (match) {
        const groupSlug = match[1];
        const stickerSlug = match[2];
        const category = customCategories.find(c => c.slug === groupSlug);
        if (category) {
          const item = category.items.find(i => i.id === stickerSlug || i.syntax === syntax);
          if (item) return item.display;
        }
      }
      return null;
    }

    // Emoji shortcode: :shortcode:
    if (syntax.startsWith(':') && syntax.endsWith(':')) {
      const shortcode = syntax.slice(1, -1);
      // 检查是否是颜文字
      if (shortcode.startsWith('kaomoji_')) {
        return kaomojiMap[shortcode] || null;
      }
      // 检查是否是 emoji
      return emojiMap[shortcode] || null;
    }

    return null;
  }, [customCategories]);

  return {
    categories,
    loading,
    error,
    search,
    getDisplayBySyntax,
    refresh: fetchCustomStickers,
  };
}