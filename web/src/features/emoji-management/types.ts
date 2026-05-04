import type { EmojiAdmin as EmojiAdminType, CreateEmojiInput as CreateEmojiInputType } from "@/hooks/useEmojisAdmin";

export type EmojiAdmin = EmojiAdminType;
export type CreateEmojiInput = CreateEmojiInputType;

export interface EmojiCardProps {
  emoji: EmojiAdmin;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export interface EmojiManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
}
