import { useSettings } from "@features/settings/api/queries";

/**
 * HeroLeft - 左侧视觉锚点（柔和阅读风）
 *
 * 简洁文字：站点 tagline + 主理人 ID「xunrua」。
 * 无粒子、无解密动画、无磁吸 —— 干净可读。
 */
const HeroLeft = () => {
	const { data } = useSettings();

	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
			<p className="mb-4 text-sm text-muted-foreground">{data?.tagline ?? "Hello World"}</p>
			<h1 className="text-6xl font-bold tracking-tight md:text-7xl">xunrua</h1>
			<p className="mt-4 max-w-sm text-sm text-muted-foreground">
				{data?.description ?? "一个写代码、记笔记、偶尔发牢骚的地方。"}
			</p>
		</div>
	);
};

export default HeroLeft;
