import { Button, Checkbox, ImagePixelReveal, Label, type PixelRevealVariant } from "@violet/ui";
import { useId, useState } from "react";

const ORDERS: { value: PixelRevealVariant; label: string }[] = [
	{ value: "ripple", label: "中心扩散" },
	{ value: "diagonal", label: "对角线" },
	{ value: "curtain", label: "自上而下" },
	{ value: "random", label: "随机" },
];

const SCENES = [
	{ sky: "#e9c7a2", sun: "#fff0cb", ridge: "#856982", land: "#494e6b", label: "日出" },
	{ sky: "#a3c5d2", sun: "#edf8f0", ridge: "#587e88", land: "#334f63", label: "晨雾" },
].map(({ sky, sun, ridge, land, label }) => ({
	label,
	src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480"><rect width="800" height="480" fill="${sky}"/><circle cx="580" cy="140" r="66" fill="${sun}"/><path d="M0 350 180 130 340 300 470 195 680 350 800 240V480H0Z" fill="${ridge}"/><path d="M0 410 220 285 390 410 600 280 800 390V480H0Z" fill="${land}"/><path d="M0 445H800M0 460H800" stroke="${sun}" stroke-opacity=".25" stroke-width="2"/></svg>`,
	)}`,
}));

export function ImagePixelRevealBasicDemo() {
	const id = useId();
	const [variant, setVariant] = useState<PixelRevealVariant>("random");
	const [replay, setReplay] = useState(0);
	const [sceneIndex, setSceneIndex] = useState(0);
	const [replayOnHover, setReplayOnHover] = useState(true);
	const [customContent, setCustomContent] = useState(false);
	const scene = SCENES[sceneIndex];

	return (
		<div className="mx-auto w-full max-w-150 space-y-4">
			<div className="flex flex-wrap gap-2" role="group" aria-label="网格揭示顺序">
				{ORDERS.map((order) => (
					<Button
						key={order.value}
						size="sm"
						variant={variant === order.value ? "primary" : "outline"}
						aria-pressed={variant === order.value}
						onClick={() => {
							setVariant(order.value);
							setReplay((count) => count + 1);
						}}
					>
						{order.label}
					</Button>
				))}
			</div>
			<ImagePixelReveal
				key={`${replay}-${customContent}`}
				src={scene.src}
				alt={`${scene.label}中的群山与湖面`}
				variant={variant}
				replayOnHover={replayOnHover}
				loading="eager"
				className="aspect-5/3 w-full overflow-hidden rounded-xl"
				imgClassName="h-full w-full object-cover"
			>
				{customContent ? (
					<figure className="relative m-0 h-full w-full">
						<img
							src={scene.src}
							alt={`${scene.label}中的群山与湖面`}
							className="h-full w-full object-cover"
						/>
						<figcaption className="absolute inset-x-0 bottom-0 bg-black/50 px-4 py-3 text-sm text-white">
							{scene.label} · 图片和说明由同一层网格揭示
						</figcaption>
					</figure>
				) : undefined}
			</ImagePixelReveal>
			<div className="flex flex-wrap items-center gap-3">
				<Button size="sm" onClick={() => setReplay((count) => count + 1)}>
					完整重播
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => setSceneIndex((index) => (index + 1) % SCENES.length)}
				>
					切换 src
				</Button>
				<div className="flex items-center gap-2 text-sm">
					<Checkbox
						id={`${id}-hover`}
						checked={replayOnHover}
						onCheckedChange={(checked) => setReplayOnHover(checked === true)}
					/>
					<Label htmlFor={`${id}-hover`}>悬停重播</Label>
				</div>
				<div className="flex items-center gap-2 text-sm">
					<Checkbox
						id={`${id}-content`}
						checked={customContent}
						onCheckedChange={(checked) => setCustomContent(checked === true)}
					/>
					<Label htmlFor={`${id}-content`}>自定义 children</Label>
				</div>
			</div>
			<p className="text-sm text-muted-foreground">
				图片瓦片逐块裁剪展开，原图不缩放；随机顺序每轮重新洗牌。 完整重播通过 key
				重新挂载，系统开启减弱动态时直接显示。
			</p>
		</div>
	);
}
