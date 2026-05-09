/**
 * 项目表格骨架屏
 */
export function ProjectsTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="w-20 p-3 text-left font-medium">封面</th>
            <th className="p-3 text-left font-medium">项目名称</th>
            <th className="p-3 text-left font-medium">描述</th>
            <th className="p-3 text-left font-medium">技术栈</th>
            <th className="w-20 p-3 text-left font-medium">排序</th>
            <th className="p-3 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="border-t">
              <td className="p-3">
                <div className="size-7 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-3">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-3">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-3">
                <div className="h-4 w-8 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-3">
                <div className="h-8 w-24 animate-pulse rounded bg-muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}