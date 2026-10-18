import { contentImageUrl } from "@shared/lib/image-url";
import { useCallback, useState } from "react";

export interface ProjectCoverProps {
	/** 封面图地址；空串或加载失败时显示占位。 */
	src: string;
	/** 占位上显示它的首字母。 */
	title: string;
}

/** 项目封面：真实图片，没有或失效时回落到带首字母的占位，页面不出现碎图。 */
export function ProjectCover({ src, title }: ProjectCoverProps) {
	// 失败态按地址记录：地址变了自然重置
	const [brokenFor, setBrokenFor] = useState<string | null>(null);
	const showImage = src !== "" && brokenFor !== src;
	// 服务端直出的图片可能在水合之前就已经加载失败，onError 来不及接：挂载时补查一次。
	// 已结束却没有尺寸的，是失败了，或是没有固有尺寸的 SVG；decode 只对失败的图片拒绝。
	// 这里没有 loading="lazy"：Chrome 对还没开始加载的懒加载图片也报告 complete，会被误判成失败
	const checkLoaded = useCallback(
		(node: HTMLImageElement | null) => {
			if (!node?.complete || node.naturalWidth > 0 || typeof node.decode !== "function")
				return;
			node.decode().catch(() => setBrokenFor(src));
		},
		[src],
	);
	return (
		<span className="block size-18 overflow-hidden rounded-xl bg-muted sm:size-28">
			{showImage ? (
				<img
					ref={checkLoaded}
					src={contentImageUrl(src, { width: 240 })}
					alt=""
					className="size-full object-cover"
					onError={() => setBrokenFor(src)}
				/>
			) : (
				<span
					aria-hidden="true"
					data-testid="project-cover-placeholder"
					className="grid size-full place-items-center font-mono text-3xl font-bold text-muted-foreground/60"
				>
					{title.slice(0, 1).toUpperCase()}
				</span>
			)}
		</span>
	);
}
