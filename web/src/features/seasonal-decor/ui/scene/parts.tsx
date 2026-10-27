/**
 * 四季插画共用的原子：入场时序打包、有机边缘滤镜、生长中的枝条、桃花部件与嫩叶。
 */
import type { CSSProperties } from "react";

import { centerline, type Limb, taperedPath } from "../../model/geometry";
import { leafPath, petalPath } from "../../model/shapes";
import styles from "../../scene.module.css";

/** 打包入场动画的延迟与时长（秒），各原子样式从这两个变量取值。 */
export const timing = (delay: number, duration?: number) =>
	({
		"--delay": `${delay.toFixed(2)}s`,
		...(duration ? { "--duration": `${duration.toFixed(2)}s` } : {}),
	}) as CSSProperties;

/** 有机边缘：轻微扰动轮廓，去掉矢量图的机械感。 */
export function RoughFilter({
	id,
	scale = 2.4,
	frequency = 0.04,
}: {
	id: string;
	scale?: number;
	frequency?: number;
}) {
	return (
		<filter id={id} x="-10%" y="-10%" width="120%" height="120%">
			<feTurbulence
				type="fractalNoise"
				baseFrequency={frequency}
				numOctaves={2}
				seed={7}
				result="noise"
			/>
			<feDisplacementMap
				in="SourceGraphic"
				in2="noise"
				scale={scale}
				xChannelSelector="R"
				yChannelSelector="G"
			/>
		</filter>
	);
}

/** 收细的枝条，用沿主干推进的描边遮罩揭开；遮罩描边只需不透明，颜色取背景档。 */
export function GrowingLimb({
	limb,
	id,
	fill,
	filter,
}: {
	limb: Limb;
	id: string;
	fill: string;
	filter?: string;
}) {
	return (
		<g>
			<mask id={id}>
				<path
					d={centerline(limb.points)}
					pathLength={1}
					className={styles.grow}
					style={{
						...timing(limb.start, limb.duration),
						fill: "none",
						stroke: "var(--background)",
						strokeWidth: limb.widths[0] * 1.6 + 8,
						strokeDasharray: "1 1",
					}}
				/>
			</mask>
			<path d={taperedPath(limb)} mask={`url(#${id})`} filter={filter} style={{ fill }} />
		</g>
	);
}

/** 桃花的三档花瓣渐变与嫩叶渐变；prefix 内已含场景前缀。 */
export function PetalGradients({ prefix }: { prefix: string }) {
	const variants: [number, number][] = [
		[0.22, 0.6],
		[0.3, 0.75],
		[0.14, 0.5],
	];
	return (
		<>
			{variants.map(([deep, mid], i) => (
				<radialGradient key={deep} id={`${prefix}-petal-${i}`} cx="0.5" cy="1" r="1.1">
					<stop offset={0} style={{ stopColor: "var(--petal-deep)" }} />
					<stop offset={deep} style={{ stopColor: "var(--petal-mid)" }} />
					<stop offset={mid} style={{ stopColor: "var(--petal-light)" }} />
					<stop
						offset={1}
						style={{ stopColor: "var(--petal-light)", stopOpacity: 0.85 }}
					/>
				</radialGradient>
			))}
			<linearGradient id={`${prefix}-sprout`} x1="0" y1="1" x2="0" y2="0">
				<stop offset={0} style={{ stopColor: "var(--sprout-deep)" }} />
				<stop offset={1} style={{ stopColor: "var(--sprout)" }} />
			</linearGradient>
		</>
	);
}

/** 一朵桃花：五瓣盛开或三瓣初开，盛开后浮现花蕊。 */
export function Blossom({
	x,
	y,
	r,
	rotate,
	time,
	variant,
	prefix,
	open = 5,
}: {
	x: number;
	y: number;
	r: number;
	rotate: number;
	time: number;
	variant: number;
	prefix: string;
	open?: number;
}) {
	const angles = open === 5 ? [0, 72, 144, 216, 288] : [-58, 0, 58];
	return (
		<g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate.toFixed(1)})`}>
			{angles.map((angle, k) => (
				<g key={angle} transform={`rotate(${angle})`}>
					<path
						d={petalPath(r)}
						className={styles.petal}
						style={{
							...timing(time + k * 0.08),
							fill: `url(#${prefix}-petal-${variant})`,
						}}
					/>
				</g>
			))}
			{open === 5 ? (
				<g className={styles.fade} style={timing(time + 0.45, 0.6)}>
					<circle r={r * 0.17} style={{ fill: "var(--petal-deep)" }} />
					{Array.from({ length: 11 }, (_, k) => {
						const a = (k / 11) * Math.PI * 2 + 0.2;
						const len = r * (0.36 + ((k * 7) % 5) * 0.03);
						return (
							<g key={a}>
								<line
									x1={0}
									y1={0}
									x2={Math.cos(a) * len}
									y2={Math.sin(a) * len}
									style={{
										stroke: "var(--petal-deep)",
										strokeWidth: 0.45,
										opacity: 0.7,
									}}
								/>
								<circle
									cx={Math.cos(a) * len}
									cy={Math.sin(a) * len}
									r={0.85}
									style={{ fill: "var(--anther)" }}
								/>
							</g>
						);
					})}
				</g>
			) : null}
		</g>
	);
}

/** 花苞：萼片托着一片压扁的花瓣。 */
export function Bud({
	x,
	y,
	r,
	rotate,
	time,
	prefix,
}: {
	x: number;
	y: number;
	r: number;
	rotate: number;
	time: number;
	prefix: string;
}) {
	return (
		<g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate.toFixed(1)})`}>
			<path
				d={leafPath(r * 1.6, r * 0.42)}
				className={styles.leaf}
				style={{
					...timing(time),
					fill: "var(--sprout-deep)",
					["--fold" as string]: "0deg",
				}}
			/>
			<g transform="scale(0.62 1)">
				<path
					d={petalPath(r)}
					className={styles.petal}
					style={{ ...timing(time + 0.1), fill: `url(#${prefix}-petal-1)` }}
				/>
			</g>
		</g>
	);
}

/** 对生的两片嫩叶从叶柄处展开。 */
export function SproutLeaf({
	x,
	y,
	length,
	rotate,
	time,
	prefix,
	fold,
}: {
	x: number;
	y: number;
	length: number;
	rotate: number;
	time: number;
	prefix: string;
	fold: number;
}) {
	return (
		<g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate.toFixed(1)})`}>
			<path
				d={leafPath(length, length * 0.2)}
				className={styles.leaf}
				style={{
					...timing(time),
					fill: `url(#${prefix}-sprout)`,
					["--fold" as string]: `${fold}deg`,
				}}
			/>
		</g>
	);
}
