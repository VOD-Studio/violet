// 表情包类型定义

// 表情包组类型
export type StickerGroupType = 'custom' | 'emoji' | 'kaomoji';

// 自定义表情包（图片）
export interface Sticker {
  id: string;
  groupId: string;
  name: string;
  slug: string;
  imageUrl: string;
  width?: number;
  height?: number;
  usageCount: number;
  sortOrder: number;
  isActive: boolean;
}

// 表情包组
export interface StickerGroup {
  id: string;
  name: string;
  slug: string;
  type: StickerGroupType;
  iconUrl?: string;
  description?: string;
  sortOrder: number;
  isHot: boolean;
  isOfficial: boolean;
  isActive: boolean;
  stickers?: Sticker[];
}

// API 返回的表情包组列表响应
export interface StickersResponse {
  groups: StickerGroup[];
}

// 表情选择器回调的选中项
export interface StickerSelection {
  type: StickerGroupType;
  // 表情包: groupSlug/stickerSlug
  // Emoji: shortcode
  // 颜文字: shortcode
  value: string;
  // 用于显示的文本/图片
  displayText?: string;
  displayImage?: string;
}

// 表情选择器属性
export interface StickerPickerProps {
  onSelect: (syntax: string) => void;
  onClose?: () => void;
}