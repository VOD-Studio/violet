"use client";

import type { CSSProperties, MouseEvent, ReactNode, SyntheticEvent } from "react";
import { useState } from "react";

import { safeUrl } from "../data/urls.ts";

export function stopInteraction(event: SyntheticEvent): void {
	/** Portal 事件沿 React 树冒泡；不拦截 DOM 树外灯箱的键盘事件。 */
	if (event.target instanceof Node && event.currentTarget.contains(event.target))
		event.stopPropagation();
}

export function TweetLink({
	href,
	children,
	className,
	label,
	tabIndex,
	style,
	onActivate,
}: {
	href?: string;
	children: ReactNode;
	className?: string;
	label?: string;
	tabIndex?: number;
	style?: CSSProperties;
	/** 在阻止冒泡之后调用；可 preventDefault 以接管跳转。 */
	onActivate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
	const url = safeUrl(href);
	if (!url) return <span className={className}>{children}</span>;
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className={className}
			aria-label={label}
			tabIndex={tabIndex}
			style={style}
			onClick={(event) => {
				stopInteraction(event);
				onActivate?.(event);
			}}
			onKeyDown={stopInteraction}
			onPointerDown={stopInteraction}
		>
			{children}
		</a>
	);
}

export function TweetImage({
	src,
	alt,
	className,
	width,
	height,
	fallback,
}: {
	src?: string;
	alt: string;
	className?: string;
	width?: number;
	height?: number;
	fallback: ReactNode;
}) {
	const url = safeUrl(src);
	const [failedUrl, setFailedUrl] = useState<string>();
	if (!url || failedUrl === url) return <span className={className}>{fallback}</span>;
	return (
		<img
			src={url}
			alt={alt}
			className={className}
			width={width}
			height={height}
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			onError={() => setFailedUrl(url)}
		/>
	);
}

export function TweetDate({ value, formatter }: { value: string; formatter: Intl.DateTimeFormat }) {
	const match =
		/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(
			value,
		);
	const timestamp = match ? Date.parse(value) : NaN;
	const days = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate() : 0;
	if (
		!match ||
		!Number.isFinite(timestamp) ||
		Number(match[2]) < 1 ||
		Number(match[2]) > 12 ||
		Number(match[3]) < 1 ||
		Number(match[3]) > days
	) {
		return <span>{value}</span>;
	}
	return <time dateTime={value}>{formatter.format(timestamp)}</time>;
}
