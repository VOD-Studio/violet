// 表情系统类型定义

// 表情来源类型
export type EmojiSource = "system" | "bilibili" | "custom"

// 表情分组
export interface EmojiGroup {
  id: number
  name: string
  source: EmojiSource
  sortOrder: number
  isEnabled: boolean
  emojis: Emoji[]
}

// 单个表情
export interface Emoji {
  id: number
  groupId: number
  name: string
  url?: string
  textContent?: string
  sortOrder: number
}

// API 响应类型
export interface EmojisResponse {
  groups: EmojiGroup[]
}

export interface EmojiGroupsResponse {
  groups: EmojiGroup[]
}

export interface EmojisByGroupResponse {
  emojis: Emoji[]
}

// 表情选择器回调的选中项
export interface EmojiSelection {
  type: EmojiSource
  // 表情名
  value: string
  // 用于显示的文本/图片
  displayText?: string
  displayImage?: string
}

// 表情选择器属性
export interface EmojiPickerProps {
  onSelect: (syntax: string) => void
  onClose?: () => void
}