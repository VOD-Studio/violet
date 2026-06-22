import { Button } from "@shared/ui/button";
import { Link } from "@tanstack/react-router";

import ThemeToggle from "../ThemeToggle/ThemeToggle";

/**
 * HeaderActions - 右侧操作区
 *
 * ThemeToggle（主题切换）+ 登录入口。
 * 首期登录是占位路由，实际 auth 流程后续 feature 接入。
 */
const HeaderActions = () => {
	return (
		<div className="flex items-center gap-2">
			<ThemeToggle />
			<Button variant="ghost" size="sm" asChild>
				<Link to="/login">登录</Link>
			</Button>
		</div>
	);
};

export default HeaderActions;
