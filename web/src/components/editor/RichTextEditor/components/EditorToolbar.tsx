/**
 * 编辑器工具栏组件
 */

import type { Editor } from "@tiptap/react";
import { Link as LinkIcon } from "lucide-react";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarDivider } from "./ToolbarDivider";
import { getToolbarConfig } from "../config/toolbarConfig";

interface EditorToolbarProps {
  /** 编辑器实例 */
  editor: Editor;
  /** 是否固定到顶部 */
  isSticky: boolean;
  /** 工具栏引用 */
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  /** 打开链接对话框 */
  onOpenLinkDialog: () => void;
  /** 打开图片对话框 */
  onOpenImageDialog: () => void;
  /** 移除链接 */
  onUnsetLink: () => void;
  /** 插入分割线 */
  onInsertHorizontalRule: () => void;
}

/**
 * 编辑器工具栏
 */
export function EditorToolbar({
  editor,
  isSticky,
  toolbarRef,
  onOpenLinkDialog,
  onOpenImageDialog,
  onUnsetLink,
  onInsertHorizontalRule,
}: EditorToolbarProps) {
  const toolbarGroups = getToolbarConfig(
    onOpenLinkDialog,
    onOpenImageDialog,
    onUnsetLink,
    onInsertHorizontalRule
  );

  return (
    <div
      ref={toolbarRef}
      className={`flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-2 backdrop-blur-sm transition-shadow ${
        isSticky
          ? "fixed top-0 left-0 right-0 z-50 shadow-md rounded-none"
          : ""
      }`}
    >
      {toolbarGroups.map((group, groupIndex) => (
        <div key={group.name} className="flex items-center gap-0.5">
          {group.buttons.map((button, buttonIndex) => (
            <ToolbarButton
              key={`${group.name}-${buttonIndex}`}
              onClick={() => button.onClick(editor)}
              isActive={button.isActive?.(editor)}
              disabled={button.isDisabled?.(editor)}
              title={button.title}
            >
              <button.icon className="h-4 w-4" />
            </ToolbarButton>
          ))}
          {groupIndex < toolbarGroups.length - 1 && <ToolbarDivider />}
        </div>
      ))}

      {/* 移除链接按钮（仅在有链接时显示） */}
      {editor.isActive("link") && (
        <>
          <ToolbarButton onClick={onUnsetLink} title="移除链接">
            <LinkIcon className="h-4 w-4 text-destructive" />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}
