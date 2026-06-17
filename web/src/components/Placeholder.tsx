// 路由占位组件
// 2.0 重构期：尚未迁移的页面用此占位，避免引用仍依赖 react-router 的旧页面。
// 各 Route 文件导入此组件作为临时 component，待对应 Phase 迁移后替换为真实页面。

interface PlaceholderProps {
  /** 页面标题 */
  title: string;
  /** 路由路径（用于提示） */
  path?: string;
}

export function Placeholder({ title, path }: PlaceholderProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        此页面待 2.0 重构迁移{path ? `（${path}）` : ""}。
      </p>
      <span className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground">
        Placeholder
      </span>
    </div>
  );
}
