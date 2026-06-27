import type { UserDTO } from "@entities/user/model/types";
import { Button } from "@shared/ui/button";
import { Link } from "@tanstack/react-router";
import { useCommandUIStore } from "@widgets/CommandPalette/command-ui-store";
import ThemeToggle from "@widgets/ThemeToggle";
import { Command } from "lucide-react";

interface HeaderActionsProps {
    user?: UserDTO | null;
}

/**
 * HeaderActions - 右侧操作区
 *
 * - 命令面板触发按钮（调 useCommandUIStore.open，与 Cmd+K 同源）
 * - ThemeToggle（机械轴体）
 * - 管理员后台入口（仅 admin/superadmin）
 * - 登录/个人中心入口
 */
const HeaderActions = ({ user }: HeaderActionsProps) => {
    const openCommand = useCommandUIStore((s) => s.open);

    return (
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" aria-label="命令面板" onClick={openCommand}>
                <Command className="size-4" />
            </Button>
            <ThemeToggle />

            <Button variant="ghost" size="sm" asChild>
                <Link to={user ? "/profile" : "/login"}>{user ? "个人中心" : "登录"}</Link>
            </Button>
        </div>
    );
};

export default HeaderActions;
