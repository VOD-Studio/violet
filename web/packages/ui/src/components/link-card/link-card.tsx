"use client";

import { cn } from "cn";
import { type ComponentProps, useState } from "react";

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
			className={cn("v-link-card", className)}
		>
			{imageSrc && (
				<LinkCardThumbnail
					key={JSON.stringify([imageSrc, href, title, description])}
					src={imageSrc}
					alt={imageAlt}
				/>
			)}
			<span className="v-link-card__body">
				<span className="v-link-card__title">{title}</span>
				{showDescription && (
					<span className="v-link-card__description">{visibleDescription}</span>
				)}
				{(showSite || host) && (
					<span className="v-link-card__meta">
						{showSite && <span className="v-link-card__site">{site}</span>}
						{showSite && host && <span aria-hidden="true">·</span>}
						{host && <span className="v-link-card__host">{host}</span>}
					</span>
				)}
			</span>
		</a>
	);
}
