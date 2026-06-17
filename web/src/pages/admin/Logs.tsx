/**
 * 操作日志页面
 * 系统操作日志查看入口（占位实现）
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScrollText } from "lucide-react";

/**
 * 操作日志页面
 */
export default function Logs() {
  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div>
        <h1 className="text-2xl font-bold">操作日志</h1>
        <p className="text-muted-foreground">查看系统操作记录</p>
      </div>

      {/* 日志占位卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>日志列表</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="暂无日志"
            description="操作日志功能正在开发中，后续将接入审计日志 API。"
            icon={<ScrollText className="size-12" />}
          />
        </CardContent>
      </Card>
    </div>
  );
}
