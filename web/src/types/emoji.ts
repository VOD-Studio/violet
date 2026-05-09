/**
 * 表情系统类型定义
 * 与后端 API 响应保持一致（snake_case）
 */

/** 表情来源类型 */
export type EmojiSource = "system" | "bilibili" | "custom";

/** 表情分组（后端响应格式） */
export interface EmojiGroup {
  /** 分组 ID */
  id: number;
  /** 分组名称 */
  name: string;
  /** 表情来源 */
  source: EmojiSource;
  /** 排序权重 */
  sort_order: number;
  /** 是否启用 */
  is_enabled: boolean;
  /** 创建时间 */
  created_at: string;
  /** 分组下的表情列表 */
  emojis?: Emoji[];
}

/** 单个表情（后端响应格式） */
export interface Emoji {
  /** 表情 ID */
  id: number;
  /** 所属分组 ID */
  group_id: number;
  /** 表情名称 */
  name: string;
  /** 表情图片 URL */
  url?: string;
  /** 表情 GIF 动图 URL */
  gif_url?: string;
  /** 来源 URL */
  source_url?: string;
  /** 文本内容（颜文字） */
  text_content?: string;
  /** 排序权重 */
  sort_order: number;
  /** 创建时间 */
  created_at: string;
}

/** 表情列表 API 响应 */
export interface EmojisResponse {
  /** 表情分组列表 */
  groups: EmojiGroup[];
}

/** 表情分组列表 API 响应 */
export interface EmojiGroupsResponse {
  /** 表情分组列表 */
  groups: EmojiGroup[];
}

/** 按分组获取表情 API 响应 */
export interface EmojisByGroupResponse {
  /** 表情列表 */
  emojis: Emoji[];
}

/** 表情选择器回调的选中项 */
export interface EmojiSelection {
  /** 表情来源类型 */
  type: EmojiSource;
  /** 表情名 */
  value: string;
  /** 用于显示的文本 */
  displayText?: string;
  /** 用于显示的图片 URL */
  displayImage?: string;
}

/** 表情选择器组件的属性 */
export interface EmojiPickerProps {
  /** 选中表情回调 */
  onSelect: (syntax: string) => void;
  /** 关闭回调 */
  onClose?: () => void;
}
