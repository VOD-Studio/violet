import type { EmojiAdmin as EmojiAdminType, CreateEmojiInput as CreateEmojiInputType } from "@/hooks/useEmojisAdmin";

export type EmojiAdmin = EmojiAdminType;
export type CreateEmojiInput = CreateEmojiInputType;

/** EmojiCard 组件的属性 */
export interface EmojiCardProps {
  /** 表情数据 */
  emoji: EmojiAdmin;
  /** 是否为批量选择模式 */
  isSelectMode: boolean;
  /** 是否已选中 */
  isSelected: boolean;
  /** 切换选中回调 */
  onToggleSelect: () => void;
  /** 编辑回调 */
  onEdit: () => void;
  /** 删除回调 */
  onDelete: () => void;
}

/** EmojiManageDialog 组件的属性 */
export interface EmojiManageDialogProps {
  /** 是否打开弹窗 */
  open: boolean;
  /** 打开/关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 分组 ID */
  groupId: number;
}
