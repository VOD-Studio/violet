/**
 * 编辑器状态栏组件
 */

interface EditorStatusBarProps {
  /** 字符数 */
  charCount: number;
}

/**
 * 编辑器底部状态栏
 */
export function EditorStatusBar({ charCount }: EditorStatusBarProps) {
  return (
    <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
      <span>字数: {charCount}</span>
      <span>支持 Markdown 快捷键</span>
    </div>
  );
}
