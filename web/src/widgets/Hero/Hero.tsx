import { useSettings } from "@features/settings/api/queries";
import { Button } from "@shared/ui/button";
import Aurora from "@shared/vendor/react-bits/Aurora";
import DecryptedText from "@shared/vendor/react-bits/DecryptedText";
import GradientText from "@shared/vendor/react-bits/GradientText";
import { Link } from "@tanstack/react-router";

/**
 * Hero - 首页头部英雄区
 *
 * react-bits 三组件组合（首页仅用 3 个，不堆砌）：
 * - Aurora：背景渐变（WebGL 渲染）
 * - GradientText：站名渐变动画文字
 * - DecryptedText：签名解密动画
 *
 * 配置从站点 settings 读（SSR 已预取），未加载时显示占位文案避免闪烁。
 */
const Hero = () => {
	const { data } = useSettings();

	return (
		<section className="relative overflow-hidden py-24">
			<div className="absolute inset-0 -z-10">
				<Aurora />
			</div>
			<div className="container mx-auto px-4 text-center">
				<h1 className="text-5xl md:text-7xl font-bold mb-6">
					<GradientText>{data?.siteName ?? "Blog"}</GradientText>
				</h1>
				<p className="text-xl md:text-2xl text-muted-foreground mb-8">
					<DecryptedText text={data?.tagline ?? "Hello World"} />
				</p>
				<Button size="lg" asChild>
					<Link to="/blog">进入博客</Link>
				</Button>
			</div>
		</section>
	);
};

export default Hero;
