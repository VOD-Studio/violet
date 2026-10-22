/** 导出面板的参数，与 exportGif / exportWebm 的选项一一对应。 */
export interface ExportSettings {
	format: "gif" | "webm";
	/** 输出宽度，像素；null 为画稿原尺寸 */
	width: number | null;
	fps: number;
	/** 导出时长，秒；null 为时间轴原长 */
	duration: number | null;
	/** 末帧停留，秒 */
	hold: number;
	/** GIF：true 无限循环，false 只播一次 */
	loop: boolean;
	/** WebM 码率，bit/s；null 为按像素数估算 */
	bitrate: number | null;
}

/** 由面板参数生成可复制的导出代码，省略与默认值相同的选项。 */
export function exportCode(settings: ExportSettings): string {
	const gif = settings.format === "gif";
	const lines = ["  schedule,"];
	if (settings.width !== null) lines.push(`  width: ${settings.width},`);
	if (settings.fps !== 25) lines.push(`  fps: ${settings.fps},`);
	if (settings.duration !== null)
		lines.push(`  duration: ${settings.duration}, // 整条时间轴压缩到 ${settings.duration} 秒`);
	if (settings.hold !== 1) lines.push(`  hold: ${settings.hold},`);
	if (gif && !settings.loop) lines.push("  loop: 1, // 只播放一次");
	if (!gif && settings.bitrate !== null)
		lines.push(`  bitrate: ${formatNumber(settings.bitrate)},`);
	lines.push(
		"  signal: controller.signal,",
		"  onProgress: (done, total) => (progress.value = done / total),",
	);
	const call = `${gif ? "exportGif" : "exportWebm"}(drawing, palette, {\n${lines.join("\n")}\n})`;
	return gif
		? `import { exportGif } from "@violetjs/inkline/export";\n\nconst blob = await ${call};`
		: `import { canExportWebm, exportWebm } from "@violetjs/inkline/export";\n\nif (await canExportWebm()) {\n  const blob = await ${call.replaceAll("\n", "\n  ")};\n}`;
}

/** 数字字面量按三位一组加下划线，与源码风格一致。 */
function formatNumber(value: number): string {
	return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "_");
}
