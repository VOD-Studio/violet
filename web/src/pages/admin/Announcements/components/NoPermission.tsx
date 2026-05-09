/** 无权限提示组件 */

import { Bell } from "lucide-react";

export function NoPermission() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <Bell className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">无权限访问</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        您没有公告管理权限，请联系管理员
      </p>
    </div>
  );
}
