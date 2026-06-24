import { useSettings } from "@features/settings/api/queries";
import { Magnetic } from "@shared/ui/magnetic";
import DecryptedText from "@shared/vendor/react-bits/DecryptedText";
import ParticleField from "@shared/vendor/react-bits/ParticleField";

/**
 * HeroLeft - 左侧视觉锚点（spec Left 50%）
 *
 * - 鼠标跟随流体粒子（ParticleField）
 * - 核心 ID「xunrua」用赛博解密动画出场（DecryptedText，view 触发）
 * - 配置从站点 settings 读（SSR 已预取），未加载显示占位
 *
 * 注意：主理人 ID 固定 xunrua（spec 指定），不读 settings。
 */
const HeroLeft = () => {
	const { data } = useSettings();

	return (
		<div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
			<div className="absolute inset-0 -z-10">
				<ParticleField />
			</div>
			<div className="px-6 text-center">
				<p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					{data?.tagline ?? "Hello World"}
				</p>
				<h1 className="font-mono text-6xl font-bold tracking-tight md:text-8xl">
					<Magnetic strength={0.3}>
						<DecryptedText
							text="xunrua"
							animateOn="view"
							speed={60}
							maxIterations={12}
							parentClassName="inline-block"
							className="bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent"
							encryptedClassName="text-muted-foreground"
						/>
					</Magnetic>
				</h1>
			</div>
		</div>
	);
};

export default HeroLeft;
