"use client";

import { cn } from "cn";
import { type ComponentProps, useState } from "react";
import { Skeleton } from "../skeleton";

/** 原生链接属性和 ref 属于整卡；内容由预览字段生成，不接管导航或请求。 */
export interface LinkCardProps
	extends Omit<ComponentProps<"a">, "children" | "dangerouslySetInnerHTML" | "href" | "title"> {
	href: string;
	title: string;
	description?: string;
	siteName?: string;
	imageSrc?: string;
	/** 未提供时图片为装饰，不重复朗读标题。 */
	imageAlt?: string;
	/** 元数据尚未就绪时显示骨架；原生链接与来源仍可用，不自行发起请求。 */
	loading?: boolean;
}

function comparableText(value: string) {
	return value
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[\p{P}\p{S}\s]/gu, "");
}

function displayHost(href: string) {
	try {
		return new URL(href).host.replace(/^www\./i, "");
	} catch {
		return "";
	}
}

function LinkCardThumbnail({ src, alt }: { src: string; alt: string }) {
	const [failed, setFailed] = useState(false);
	if (failed) return null;
	return (
		<span className="v-link-card__thumbnail">
			<img
				className="v-link-card__image"
				src={src}
				alt={alt}
				width={96}
				height={96}
				loading="lazy"
				decoding="async"
				onError={() => setFailed(true)}
			/>
		</span>
	);
}

/** 紧凑链接预览；图片失败退为文字卡，预览内容改变后重试图片。 */
export function LinkCard({
	href,
	title,
	description,
	siteName,
	imageSrc,
	imageAlt = "",
	loading = false,
	className,
	target = "_blank",
	rel = "noopener noreferrer nofollow",
	...props
}: LinkCardProps) {
	const host = displayHost(href);
	const site = siteName?.trim();
	const visibleDescription = description?.trim();
	const showDescription =
		visibleDescription && comparableText(visibleDescription) !== comparableText(title);
	const showSite = site && comparableText(site.replace(/^www\./i, "")) !== comparableText(host);

	return (
		<a
			{...props}
			href={href}
			title={title}
			target={target}
			rel={rel}
			data-slot="link-card"
			aria-busy={loading || undefined}
			aria-label={loading ? `${title}，正在读取链接预览` : props["aria-label"]}
			className={cn("v-link-card", className)}
		>
			{!loading && imageSrc && (
				<LinkCardThumbnail
					key={JSON.stringify([imageSrc, href, title, description])}
					src={imageSrc}
					alt={imageAlt}
				/>
			)}
			<div className="v-link-card__body">
				{loading ? (
					<div className="v-link-card__skeleton" aria-hidden="true">
						<Skeleton className="v-link-card__skeleton-title" />
						<Skeleton className="v-link-card__skeleton-description" />
					</div>
				) : (
					<>
						<span className="v-link-card__title">{title}</span>
						{showDescription && (
							<span className="v-link-card__description">{visibleDescription}</span>
						)}
					</>
				)}
				{(showSite || host) && (
					<span className="v-link-card__meta">
						{showSite && <span className="v-link-card__site">{site}</span>}
						{showSite && host && <span aria-hidden="true">·</span>}
						{host && <span className="v-link-card__host">{host}</span>}
					</span>
				)}
			</div>
		</a>
	);
}
