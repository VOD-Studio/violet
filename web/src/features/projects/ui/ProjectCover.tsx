import { contentImageUrl } from "@shared/lib/image-url";
import { useCallback, useState } from "react";
import { ProjectCoverArt } from "./ProjectCoverArt";

export interface ProjectCoverProps {
	/** 配置的封面优先；无图或加载失败时使用对应项目的画板插画。 */
	src: string;
	slug: string;
	title: string;
}

/** 项目封面：保留已配置图片，缺图时按项目回落到插画或首字母。 */
export function ProjectCover({ src, slug, title }: ProjectCoverProps) {
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
		<span className="block size-full overflow-hidden" aria-hidden="true">
			{showImage ? (
				<img
					ref={checkLoaded}
					src={contentImageUrl(src, { width: 1080 })}
					alt=""
					className="size-full object-cover object-top"
					onError={() => setBrokenFor(src)}
				/>
			) : (
				<ProjectCoverArt slug={slug} title={title} />
			)}
		</span>
	);
}
