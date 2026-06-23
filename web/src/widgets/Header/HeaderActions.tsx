import { Button } from "@shared/ui/button";
import { Link } from "@tanstack/react-router";
import { useCommandUIStore } from "@widgets/CommandPalette/command-ui-store";
import ThemeToggle from "@widgets/ThemeToggle";
import { Command } from "lucide-react";

/**
 * HeaderActions - 右侧操作区
 *
 * - 命令面板触发按钮（调 useCommandUIStore.open，与 Cmd+K 同源）
 * - ThemeToggle（机械轴体）
 * - 登录入口
 */
const HeaderActions = () => {
	const openCommand = useCommandUIStore((s) => s.open);

	return (
		<div className="flex items-center gap-2">
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="命令面板"
				onClick={openCommand}
			>
				<Command className="size-4" />
			</Button>
			<ThemeToggle />
			<Button variant="ghost" size="sm" asChild>
				<Link to="/login">登录</Link>
			</Button>
		</div>
	);
};

export default HeaderActions;
