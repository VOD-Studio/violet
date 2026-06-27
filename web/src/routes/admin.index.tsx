import { PageShell } from "@features/admin-layout/ui/PageShell";
import { Card, CardContent } from "@shared/ui/card";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/admin/")({
    component: AdminIndex,
});

function AdminIndex() {
    return (
        <PageShell title="概览" description="从侧边栏选择模块开始管理">
            <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
                        <LayoutDashboard className="size-6" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-base font-medium">欢迎使用 Mimo 后台</p>
                        <p className="text-muted-foreground text-sm">
                            选择左侧导航进入对应管理模块
                        </p>
                    </div>
                    <ArrowRight className="text-muted-foreground/50 size-4 md:hidden" />
                </CardContent>
            </Card>
        </PageShell>
    );
}
