import type { Tweet } from "@entities/tweet/model/types";
import { contentImageUrl } from "@shared/lib/image-url";

const WIDTH = 800;
const PADDING = 40;
const MEDIA_WIDTH = WIDTH - PADDING * 2;
const LINE_HEIGHT = 34;
const BODY_FONT = "24px system-ui, sans-serif";

type ImageSection = { heading: string; text: string; images: string[] };

function linesOf(context: CanvasRenderingContext2D, content: string) {
	context.font = BODY_FONT;
	return content.split("\n").flatMap((paragraph) => {
		const lines: string[] = [];
		let line = "";
		for (const char of paragraph) {
			if (line && context.measureText(line + char).width > MEDIA_WIDTH) {
				lines.push(line);
				line = char;
			} else {
				line += char;
			}
		}
		lines.push(line);
		return lines;
	});
}

async function loadImage(src: string) {
	if (!src) throw new Error("Tweet media URL missing");
	const url = new URL(contentImageUrl(src, { width: MEDIA_WIDTH }), window.location.href);
	if (url.origin !== window.location.origin) throw new Error("Tweet media is not same-origin");
	const response = await fetch(url, { mode: "same-origin" });
	if (!response.ok) throw new Error("Tweet media unavailable");
	return createImageBitmap(await response.blob());
}

function mediaSize(image: ImageBitmap) {
	const scale = Math.min(MEDIA_WIDTH / image.width, 480 / image.height, 1);
	return { width: image.width * scale, height: Math.ceil(image.height * scale) };
}

/** 将当前推文的作者、正文和媒体渲染为 PNG 并下载；媒体无法读取时拒绝导出。 */
export async function downloadTweetImage(tweet: Tweet, canonicalURL: string) {
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas unavailable");
	const sections: ImageSection[] = [
		{
			heading: `@${tweet.author.username}`,
			text: tweet.content,
			images: tweet.images.map(({ url }) => url),
		},
	];
	const quoted = tweet.quoted_tweet;
	if (quoted) {
		sections.push({
			heading: `引用 @${quoted.author.username}`,
			text: quoted.content,
			images: quoted.images.map(({ url }) => url),
		});
	} else if (tweet.quote_of) {
		sections.push({ heading: "引用推文已不可用", text: "", images: [] });
	}
	const external = tweet.external_tweet ?? quoted?.external_tweet;
	if (external?.availability === "available" && external.snapshot) {
		const { author, text, media } = external.snapshot;
		sections.push({
			heading: `${author.name} · @${author.handle}`,
			text,
			images: (media ?? []).map(({ url, thumbnail_url }) => thumbnail_url || url),
		});
	} else if (external) {
		sections.push({ heading: "X 原文已不可用", text: "", images: [] });
	}
	const cards = await Promise.all(
		sections.map(async ({ heading, text, images }) => ({
			heading,
			lines: text ? linesOf(context, text) : [],
			media: (await Promise.all(images.map(loadImage))).map((image) => ({
				image,
				...mediaSize(image),
			})),
		})),
	);
	canvas.width = WIDTH;
	canvas.height =
		PADDING * 2 +
		LINE_HEIGHT +
		cards.reduce(
			(height, card) =>
				height +
				LINE_HEIGHT * (card.lines.length + 2) +
				card.media.reduce((total, image) => total + image.height + 16, 0),
			0,
		);
	context.fillStyle = "white";
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.textBaseline = "top";
	let y = PADDING;
	for (const card of cards) {
		context.fillStyle = "black";
		context.font = "600 28px system-ui, sans-serif";
		context.fillText(card.heading, PADDING, y, MEDIA_WIDTH);
		y += LINE_HEIGHT;
		context.font = BODY_FONT;
		for (const line of card.lines) {
			context.fillText(line, PADDING, y, MEDIA_WIDTH);
			y += LINE_HEIGHT;
		}
		for (const { image, width, height } of card.media) {
			y += 16;
			context.drawImage(image, PADDING, y, width, height);
			image.close();
			y += height;
		}
		y += LINE_HEIGHT;
	}
	context.fillStyle = "dimgray";
	context.font = "18px system-ui, sans-serif";
	context.fillText(canonicalURL, PADDING, y, MEDIA_WIDTH);
	const { promise, resolve, reject } = Promise.withResolvers<Blob>();
	canvas.toBlob((blob) => {
		if (blob) {
			resolve(blob);
		} else {
			reject(new Error("PNG encoding failed"));
		}
	}, "image/png");
	const url = URL.createObjectURL(await promise);
	const link = document.createElement("a");
	link.href = url;
	link.download = `tweet-${tweet.id}.png`;
	document.body.append(link);
	try {
		link.click();
	} finally {
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}
