import type { PresenceSources } from "@features/presence/model/types";

/** 后台诊断用的来源摘要，每个非空来源一条。 */
export function summarizeSources(sources: PresenceSources): string[] {
	const lines: string[] = [];
	const { media, application, window } = sources;
	if (media) {
		const verb = media.state === "playing" ? "正在播放" : "已暂停";
		lines.push(
			media.artist ? `${verb}：${media.title} — ${media.artist}` : `${verb}：${media.title}`,
		);
	}
	if (application) lines.push(`正在使用 ${application.display_name}`);
	if (window) lines.push(`窗口：${window.title}`);
	return lines;
}
