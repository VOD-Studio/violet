/**
 * 工具栏按钮组件
 */

import { Button } from "@/components/ui/button";

interface ToolbarButtonProps {
  /** 点击事件 */
  onClick: () => void;
  /** 是否激活状态 */
  isActive?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 提示文本 */
  title: string;
  /** 按钮内容 */
  children: React.ReactNode;
}

export function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={isActive ? "secondary" : "ghost"}
      size="icon-sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 w-8"
    >
      {children}
    </Button>
  );
}
