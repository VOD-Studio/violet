import { cn } from "@shared/lib/utils";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import type React from "react";
import { type ReactNode, useCallback, useRef } from "react";

export interface ProfileCardProps {
	children: ReactNode;
	className?: string;
	/** 是否启用 3D 倾斜效果（默认 true） */
	enableTilt?: boolean;
	/** 是否启用表面反光光斑（默认 true） */
	enableGlare?: boolean;
	/** 背景外发光颜色类名（如 bg-neon-cyan/20） */
	behindGlowClass?: string;
	/** 最大倾斜角度（度数，默认 8） */
	maxTilt?: number;
}

/**
 * ProfileCard - React Bits 3D 全息视差个人名片
 *
 * 核心特性：
 * - 3D 物理倾斜（基于 motion/react 弹簧动效）
 * - 表面光斑折射（跟随光标的 Dynamic Glare Overlay）
 * - 背面环境霓虹发光（Behind Glow）
 * - preserve-3d 深度景深，支持子元素立体悬浮
 */
export function ProfileCard({
	children,
	className,
	enableTilt = true,
	enableGlare = true,
	behindGlowClass = "bg-primary/20",
	maxTilt = 8,
}: ProfileCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);

	const mouseX = useMotionValue(0.5);
	const mouseY = useMotionValue(0.5);

	// 弹簧物理缓动
	const springConfig = { damping: 20, stiffness: 200 };
	const smoothX = useSpring(mouseX, springConfig);
	const smoothY = useSpring(mouseY, springConfig);

	const rotateX = useTransform(smoothY, [0, 1], [maxTilt, -maxTilt]);
	const rotateY = useTransform(smoothX, [0, 1], [-maxTilt, maxTilt]);

	// 反光位置与透明度
	const glareX = useTransform(smoothX, [0, 1], ["0%", "100%"]);
	const glareY = useTransform(smoothY, [0, 1], ["0%", "100%"]);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!cardRef.current || !enableTilt) return;
			const rect = cardRef.current.getBoundingClientRect();
			const x = (e.clientX - rect.left) / rect.width;
			const y = (e.clientY - rect.top) / rect.height;
			mouseX.set(x);
			mouseY.set(y);
		},
		[enableTilt, mouseX, mouseY],
	);

	const handleMouseLeave = useCallback(() => {
		mouseX.set(0.5);
		mouseY.set(0.5);
	}, [mouseX, mouseY]);

	return (
		<div className="relative group/profile-card [perspective:1000px]">
			{/* 背面环境霓虹发光 (Behind Glow) */}
			<div
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute -inset-2 rounded-3xl blur-2xl opacity-40 transition-opacity duration-500 group-hover/profile-card:opacity-75",
					behindGlowClass,
				)}
			/>

			{/* 3D 倾斜卡片主体 */}
			<motion.div
				ref={cardRef}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
				style={{
					rotateX: enableTilt ? rotateX : 0,
					rotateY: enableTilt ? rotateY : 0,
					transformStyle: "preserve-3d",
				}}
				className={cn(
					"relative overflow-hidden rounded-3xl border border-edge-hairline/80 bg-card/60 shadow-2xl backdrop-blur-xl transition-shadow duration-300",
					className,
				)}
			>
				{/* 表面动态高光光斑 (Dynamic Glare Overlay) */}
				{enableGlare && (
					<motion.div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 z-30 opacity-0 transition-opacity duration-300 group-hover/profile-card:opacity-100 mix-blend-overlay"
						style={{
							background: useTransform(
								[glareX, glareY],
								([x, y]) =>
									`radial-gradient(circle 320px at ${x} ${y}, rgba(255, 255, 255, 0.28), transparent 70%)`,
							),
						}}
					/>
				)}

				{/* 卡片立体内容层 */}
				<div style={{ transform: "translateZ(0px)" }}>{children}</div>
			</motion.div>
		</div>
	);
}
