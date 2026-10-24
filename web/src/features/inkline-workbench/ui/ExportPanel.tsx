import { Button, Segmented } from "@violet/ui";
import { canExportWebm, exportGif, exportWebm } from "@violetjs/inkline/export";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { phasedSchedule } from "../lib/artwork";
import type { ExportSettings } from "../lib/export-code";
import { loadArtwork } from "../model/artworks";
import { useWorkbenchStore } from "../model/workbench-store";
import { Field, NativeSelect } from "./fields";

type Job =
	| { state: "idle" }
	| { state: "running"; done: number; total: number }
	| { state: "done"; url: string; name: string; size: number; seconds: number }
	| { state: "failed"; message: string };

const WIDTHS = [
	{ value: 360, label: "360 px" },
	{ value: 480, label: "480 px" },
	{ value: 720, label: "720 px" },
	{ value: 0, label: "原尺寸" },
] as const;
const DURATIONS = [
	{ value: 4, label: "压到 4 秒" },
	{ value: 8, label: "压到 8 秒" },
	{ value: 15, label: "压到 15 秒" },
	{ value: 0, label: "时间轴原长" },
] as const;
const HOLDS = [
	{ value: 0, label: "不停留" },
	{ value: 1, label: "1 秒" },
	{ value: 2, label: "2 秒" },
] as const;
const BITRATES = [
	{ value: 0, label: "自动" },
	{ value: 1_000_000, label: "1 Mbit/s" },
	{ value: 2_000_000, label: "2 Mbit/s" },
	{ value: 4_000_000, label: "4 Mbit/s" },
] as const;
const FPS = { gif: [15, 25, 50], webm: [15, 25, 30, 60] } as const;

/** 导出面板：按当前画稿与编排离线导出 GIF 或 WebM，可取消，完成后给出下载链接。 */
export function ExportPanel() {
	const settings = useWorkbenchStore((s) => s.exportSettings);
	const setExport = useWorkbenchStore((s) => s.setExport);
	const artworkKey = useWorkbenchStore((s) => s.artwork);
	const [webm, setWebm] = useState<boolean | null>(null);
	const [job, setJob] = useState<Job>({ state: "idle" });
	const controller = useRef<AbortController | null>(null);
	const gif = settings.format === "gif";

	useEffect(() => {
		void canExportWebm().then(setWebm);
	}, []);

	// 新结果替换旧结果、离开页面时释放 Blob 地址，并取消进行中的导出
	useEffect(() => {
		const url = job.state === "done" ? job.url : null;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	}, [job]);
	useEffect(() => () => controller.current?.abort(), []);

	const run = async () => {
		controller.current?.abort();
		const abort = new AbortController();
		controller.current = abort;
		setJob({ state: "running", done: 0, total: 1 });
		const started = performance.now();
		try {
			const { drawing, palette, phases } = await loadArtwork(artworkKey);
			const schedule = phasedSchedule(drawing, phases, useWorkbenchStore.getState().mode);
			const options = {
				schedule,
				width: settings.width ?? undefined,
				fps: settings.fps,
				duration: settings.duration ?? undefined,
				hold: settings.hold,
				signal: abort.signal,
				onProgress: (done: number, total: number) =>
					setJob({ state: "running", done, total }),
			};
			const blob = gif
				? await exportGif(drawing, palette, { ...options, loop: settings.loop ? true : 1 })
				: await exportWebm(drawing, palette, {
						...options,
						bitrate: settings.bitrate ?? undefined,
					});
			setJob({
				state: "done",
				url: URL.createObjectURL(blob),
				name: `inkline-${artworkKey}.${gif ? "gif" : "webm"}`,
				size: blob.size,
				seconds: (performance.now() - started) / 1000,
			});
		} catch (error) {
			if (abort.signal.aborted) setJob({ state: "idle" });
			else
				setJob({
					state: "failed",
					message: error instanceof Error ? error.message : String(error),
				});
		}
	};

	const update = (patch: Partial<ExportSettings>) => {
		setExport(patch);
		if (job.state !== "running") setJob({ state: "idle" });
	};

	return (
		<div className="grid gap-5">
			<div className="grid gap-1.5">
				<span className="text-xs text-muted-foreground">格式</span>
				<Segmented<ExportSettings["format"]>
					aria-label="导出格式"
					block
					value={settings.format}
					onValueChange={(format) =>
						update({
							format,
							fps: (FPS[format] as readonly number[]).includes(settings.fps)
								? settings.fps
								: 25,
						})
					}
					segments={[
						{ value: "gif", label: "GIF" },
						{
							value: "webm",
							label: "WebM",
							disabled: webm === false,
							title:
								webm === false
									? "这个浏览器不能用 WebCodecs 编码 VP9 或 VP8"
									: undefined,
						},
					]}
				/>
				{webm === false && (
					<p className="text-xs text-muted-foreground">
						这个浏览器不能编码 WebM，只能导出 GIF。
					</p>
				)}
			</div>
			<div className="grid grid-cols-2 gap-3">
				<Field label="宽度">
					{(id) => (
						<NativeSelect
							id={id}
							value={settings.width ?? 0}
							options={WIDTHS}
							onChange={(value) => update({ width: value || null })}
						/>
					)}
				</Field>
				<Field label="帧率">
					{(id) => (
						<NativeSelect
							id={id}
							value={settings.fps}
							options={FPS[settings.format].map((value) => ({
								value,
								label: `${value} fps`,
							}))}
							onChange={(fps) => update({ fps })}
						/>
					)}
				</Field>
				<Field label="时长">
					{(id) => (
						<NativeSelect
							id={id}
							value={settings.duration ?? 0}
							options={DURATIONS}
							onChange={(value) => update({ duration: value || null })}
						/>
					)}
				</Field>
				<Field label="末帧停留">
					{(id) => (
						<NativeSelect
							id={id}
							value={settings.hold}
							options={HOLDS}
							onChange={(hold) => update({ hold })}
						/>
					)}
				</Field>
				{gif ? (
					<Field label="循环">
						{(id) => (
							<NativeSelect
								id={id}
								value={settings.loop ? "forever" : "once"}
								options={[
									{ value: "forever", label: "无限循环" },
									{ value: "once", label: "播放一次" },
								]}
								onChange={(value) => update({ loop: value === "forever" })}
							/>
						)}
					</Field>
				) : (
					<Field label="码率">
						{(id) => (
							<NativeSelect
								id={id}
								value={settings.bitrate ?? 0}
								options={BITRATES}
								onChange={(value) => update({ bitrate: value || null })}
							/>
						)}
					</Field>
				)}
			</div>
			<div className="grid gap-2">
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						variant="primary"
						onClick={run}
						disabled={job.state === "running"}
					>
						导出 {gif ? "GIF" : "WebM"}
					</Button>
					{job.state === "running" && (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => controller.current?.abort()}
						>
							取消
						</Button>
					)}
				</div>
				{job.state === "running" && (
					<progress
						className="h-1.5 w-full accent-primary"
						aria-label="导出进度"
						max={job.total}
						value={job.done}
					/>
				)}
				<output aria-live="polite" className="text-xs text-muted-foreground">
					{job.state === "running" && `第 ${job.done} / ${job.total} 帧`}
					{job.state === "failed" && (
						<span className="text-destructive-text">{job.message}</span>
					)}
					{job.state === "done" && (
						<a
							href={job.url}
							download={job.name}
							className="inline-flex items-center gap-1 rounded-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>
							<Download aria-hidden className="size-3.5" />
							下载 {job.name} · {(job.size / 1024).toFixed(0)} KB · 用时{" "}
							{job.seconds.toFixed(1)} 秒
						</a>
					)}
				</output>
			</div>
		</div>
	);
}
