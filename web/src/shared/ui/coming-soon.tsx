import { Button } from "@shared/ui/button";
import { Link } from "@tanstack/react-router";

/**
 * ComingSoonProps - ComingSoon 组件属性
 */
export interface ComingSoonProps {
	/**
	 * 页面标题（显示在主文案中）
	 */
	title: string;
}

/**
 * ComingSoon - 占位页统一组件
 *
 * 用于 blog/about/projects/profile/login 等首期未实装的路由。
 * 显示页面标题 + 建设中文案 + 返回首页 CTA。
 * 新增 feature 后直接替换对应路由的 component 即可，无需改此组件。
 */
const ComingSoon = ({ title }: ComingSoonProps) => {
	return (
		<div className="container mx-auto px-4 py-24 text-center">
			<h1 className="text-4xl font-bold mb-4">{title}</h1>
			<p className="text-muted-foreground mb-8">建设中，敬请期待</p>
			<Button asChild>
				<Link to="/">返回首页</Link>
			</Button>
		</div>
	);
};

export default ComingSoon;
