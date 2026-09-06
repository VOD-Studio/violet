import { useSettings } from "@features/settings/api/queries";
import { Link } from "@tanstack/react-router";

/**
 * HeaderLogo - 站名 logo
 *
 * 从站点配置读取名称（SSR 已预取），点击回首页。
 * 配置未加载时显示 "Blog" 占位，避免布局闪烁。
 */
const HeaderLogo = () => {
	const { data } = useSettings();
	const rawName = data?.site_name?.trim();
	const siteName = !rawName || rawName === "My Blog" || rawName === "Blog" ? "Violet" : rawName;
	return (
		<Link to="/" className="block truncate font-mono text-xl font-bold tracking-tight">
			{siteName}
		</Link>
	);
};

export default HeaderLogo;
