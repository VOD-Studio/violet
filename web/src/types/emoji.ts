// 表情系统类型定义
// 与后端 API 响应保持一致（snake_case）

// 表情来源类型
export type EmojiSource = "system" | "bilibili" | "custom";

// 表情分组（后端响应格式）
export interface EmojiGroup {
  id: number;
  name: string;
  source: EmojiSource;
  sort_order: number;
  is_enabled: boolean;
  created_at: string;
  emojis?: Emoji[];
}

// 单个表情（后端响应格式）
export interface Emoji {
  id: number;
  group_id: number;
  name: string;
  url?: string;
  text_content?: string;
  sort_order: number;
  created_at: string;
}

// API 响应类型
export interface EmojisResponse {
  groups: EmojiGroup[];
}

export interface EmojiGroupsResponse {
  groups: EmojiGroup[];
}

export interface EmojisByGroupResponse {
  emojis: Emoji[];
}

// 表情选择器回调的选中项
export interface EmojiSelection {
  type: EmojiSource;
  // 表情名
  value: string;
  // 用于显示的文本/图片
  displayText?: string;
  displayImage?: string;
}

// 表情选择器属性
export interface EmojiPickerProps {
  onSelect: (syntax: string) => void;
  onClose?: () => void;
}
