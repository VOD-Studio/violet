import { motion } from "motion/react";
import { cn } from "@shared/lib/utils";

export interface LoaderProps {
	/** 文案（mono 字体显示在轨道下方），省略则只显示轨道 */
	label?: string;
	/** 尺寸 */
	size?: "sm" | "md" | "lg";
	className?: string;
}

const DIM = {
	sm: 48,
	md: 80,
	lg: 120,
};

/**
 * Loader - 轨道环 + 粒子（原子模型）
 *
 * 创意：中心一个 neon 脉冲核，外围 3 条椭圆轨道（各自 rotateX/rotateY
 * 倾斜成 3D 椭圆），每条轨道上挂一颗发光粒子做公转，像原子模型自转。
 *
 * 粒子公转实现：每条轨道是一个以中心为 transformOrigin 的旋转容器，
 * motion 让它 rotate(360deg)；粒子固定贴在容器的「右边缘中点」，
 * 容器一转，粒子就被甩成圆周轨迹（再叠 rotateX 压扁成椭圆）。
 *
 * 纯 transform 动画（无 reflow），GPU 友好；颜色全走 CSS 变量
 * （neon-blue/purple/green），自动跟随双主题。
 *
 * 通用用法：<Loader label="加载中" /> 或 <Loader size="sm" />
 */
const Loader = ({ label, size = "md", className }: LoaderProps) => {
	const d = DIM[size];

	const orbits = [
		{ tilt: "rotateX(70deg)", color: "var(--color-neon-blue)", dur: 1.8 },
		{ tilt: "rotateY(70deg)", color: "var(--color-neon-purple)", dur: 2.3 },
		{ tilt: "rotateX(70deg) rotateY(70deg)", color: "var(--color-neon-green)", dur: 2.8 },
	];

	return (
		<div
			className={cn("flex flex-col items-center justify-center gap-3", className)}
			role="status"
			aria-live="polite"
			aria-label={label ?? "加载中"}
		>
			<div className="relative" style={{ width: d, height: d, transformStyle: "preserve-3d" }}>
				{/* 中心核：脉冲发光 */}
				<motion.span
					className="absolute left-1/2 top-1/2 rounded-full bg-neon-blue"
					style={{
						width: d * 0.16,
						height: d * 0.16,
						marginLeft: -(d * 0.08),
						marginTop: -(d * 0.08),
						boxShadow: "0 0 12px hsl(var(--neon-blue) / 0.9)",
					}}
					animate={{ scale: [1, 1.25, 1], opacity: [0.85, 1, 0.85] }}
					transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
				/>

				{/* 三条轨道：各自倾斜，粒子贴在容器右边缘做公转 */}
				{orbits.map((orbit, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: 静态三条轨道
						key={i}
						className="absolute inset-0"
						style={{ transform: orbit.tilt, transformStyle: "preserve-3d" }}
					>
						{/* 轨道线：极细椭圆边（已被外层 tilt 压扁） */}
						<div
							className="absolute inset-0 rounded-full border"
							style={{ borderColor: "hsl(var(--edge-hairline))" }}
						/>
						{/* 公转容器：以中心为原点，旋转即带动粒子画圆 */}
						<motion.div
							className="absolute inset-0"
							style={{ transformOrigin: "center center" }}
							animate={{ rotate: 360 }}
							transition={{ duration: orbit.dur, repeat: Infinity, ease: "linear" }}
						>
							{/* 粒子：贴在容器右边缘中点 */}
							<span
								className="absolute top-1/2 rounded-full"
								style={{
									right: -(d * 0.05),
									width: d * 0.1,
									height: d * 0.1,
									marginTop: -(d * 0.05),
									backgroundColor: orbit.color,
									boxShadow: `0 0 8px ${orbit.color}`,
								}}
							/>
						</motion.div>
					</div>
				))}
			</div>

			{label ? (
				<p className="font-mono text-xs tracking-wider text-muted-foreground">
					{label}
				</p>
			) : null}
		</div>
	);
};

export default Loader;
