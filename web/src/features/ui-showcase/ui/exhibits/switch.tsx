import { Switch } from "@violet/ui";
import { useEffect, useId, useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

/**
 * 状态矩阵里悬停与键盘聚焦是画不出来的交互态：用包裹元素的 data-demo
 * 属性在展品自有的样式里套用单元自己的调色板变量，不给单元加演示钩子。
 */
const DEMO_STATE_CSS = `
[data-demo="hover"] .v-switch:not([data-state="checked"]){background-color:var(--v-switch-off-hover)}
[data-demo="hover"] .v-switch[data-state="checked"]{background-color:var(--v-switch-on-hover)}
[data-demo="focus"] .v-switch{outline:2px solid var(--ring);outline-offset:2px}
`;

const SETTINGS = [
	{ id: "comments", label: "评论通知", description: "有人回复你时，发一封邮件", on: true },
	{ id: "friend-links", label: "友链更新", description: "友链站点有新文章时提醒", on: false },
	{ id: "decorations", label: "季节装饰", description: "背景的落花、落叶与落雪", on: true },
];

const MATRIX_COLUMNS = [
	{ id: "default", label: "默认" },
	{ id: "hover", label: "悬停" },
	{ id: "focus", label: "键盘聚焦" },
	{ id: "loading", label: "加载" },
	{ id: "disabled", label: "禁用" },
];

const SIZES = [
	{ id: "sm", label: "小 · 28 × 16，圆钮 12" },
	{ id: "md", label: "中 · 36 × 20，圆钮 16" },
	{ id: "lg", label: "触屏 · 44 × 24，圆钮 20" },
] as const;

/** 独立开关：立即生效、等服务端、失败退回。 */
function SingleSwitches() {
	const id = useId();
	const [darkMode, setDarkMode] = useState(false);
	const [publicPage, setPublicPage] = useState(false);
	const [publicBusy, setPublicBusy] = useState(false);
	const [sync, setSync] = useState(false);
	const [syncBusy, setSyncBusy] = useState(false);
	const [syncError, setSyncError] = useState(false);

	const timers = useRef<number[]>([]);

	useEffect(() => () => timers.current.forEach(clearTimeout), []);

	const delay = (action: () => void) => {
		const timer = window.setTimeout(action, 1200);
		timers.current.push(timer);
	};

	const requestPublicPage = (next: boolean) => {
		setPublicPage(next);
		if (next) {
			setPublicBusy(true);
			delay(() => setPublicBusy(false));
		}
	};

	const requestSync = (next: boolean) => {
		setSync(next);
		setSyncError(false);
		if (!next) return;
		setSyncBusy(true);
		delay(() => {
			setSyncBusy(false);
			setSync(false);
			setSyncError(true);
		});
	};

	return (
		<div className="flex w-80 flex-col gap-3.5">
			<div className="flex items-center justify-between gap-4">
				<span id={`${id}-dark`} className="text-14">
					深色模式
				</span>
				<Switch
					aria-labelledby={`${id}-dark`}
					checked={darkMode}
					onCheckedChange={setDarkMode}
				/>
			</div>
			<div className="flex items-center justify-between gap-4">
				<span className="text-14">公开个人主页</span>
				<Switch
					aria-label="公开个人主页"
					checked={publicPage}
					loading={publicBusy}
					onCheckedChange={requestPublicPage}
				/>
			</div>
			<div className="flex items-center justify-between gap-4">
				<span className="text-14">同步到 Mastodon</span>
				<Switch
					aria-label="同步到 Mastodon"
					aria-invalid={syncError}
					aria-describedby={syncError ? `${id}-sync-reason` : undefined}
					checked={sync}
					loading={syncBusy}
					onCheckedChange={requestSync}
				/>
			</div>
			<p
				id={`${id}-sync-reason`}
				className={`text-13 ${syncError ? "text-destructive" : "text-muted-foreground"}`}
			>
				{syncError
					? "服务端拒绝：授权已过期，圆钮已退回原位"
					: "点击后先切过去，服务端拒绝时退回并说明原因"}
			</p>
		</div>
	);
}

/** 设置列表：标题加说明在左，开关在右。 */
function SettingsList() {
	const id = useId();
	const [settings, setSettings] = useState(() =>
		SETTINGS.map((setting) => ({ id: setting.id, on: setting.on })),
	);
	return (
		<div className="flex w-80 flex-col gap-3">
			{SETTINGS.map((setting, index) => (
				<div key={setting.id} className="flex items-center justify-between gap-6">
					<span className="flex flex-col">
						<span id={`${id}-${setting.id}`} className="text-14 font-medium">
							{setting.label}
						</span>
						<span className="text-13 text-muted-foreground">{setting.description}</span>
					</span>
					<Switch
						aria-labelledby={`${id}-${setting.id}`}
						checked={settings[index].on}
						onCheckedChange={(next) =>
							setSettings((current) =>
								current.map((item, position) =>
									position === index ? { ...item, on: next } : item,
								),
							)
						}
					/>
				</div>
			))}
		</div>
	);
}

/** 关/开 × 默认/悬停/键盘聚焦/加载/禁用 的状态矩阵。 */
function SwitchMatrix() {
	return (
		<div className="grid w-80 grid-cols-[2.5rem_repeat(5,minmax(0,1fr))] items-center gap-x-3 gap-y-4">
			<span />
			{MATRIX_COLUMNS.map((column) => (
				<span key={column.id} className="text-center text-12 text-muted-foreground">
					{column.label}
				</span>
			))}
			{(["off", "on"] as const).map((row) => (
				<MatrixRow key={row} row={row} />
			))}
		</div>
	);
}

function MatrixRow({ row }: { row: "off" | "on" }) {
	const checked = row === "on";
	const name = `矩阵示例 ${row === "on" ? "开" : "关"}`;
	return (
		<>
			<span className="text-14 text-muted-foreground">{row === "on" ? "开" : "关"}</span>
			{MATRIX_COLUMNS.map((column) => (
				<span key={column.id} data-demo={column.id} className="flex justify-center">
					<Switch
						aria-label={`${name} ${column.label}`}
						checked={checked}
						loading={column.id === "loading"}
						disabled={column.id === "disabled"}
					/>
				</span>
			))}
		</>
	);
}

/** 三档尺寸，均以开启态展示。 */
function SwitchSizes() {
	return (
		<div className="flex w-80 flex-col gap-3">
			{SIZES.map((size) => (
				<span key={size.id} className="flex items-center gap-4">
					<Switch size={size.id} defaultChecked aria-label={`${size.label} 开关`} />
					<span className="text-13 text-muted-foreground">{size.label}</span>
				</span>
			))}
		</div>
	);
}

function SwitchFamily({ state }: ExhibitRenderProps) {
	return (
		<div className="p-1">
			<style>{DEMO_STATE_CSS}</style>
			{state === "list" ? <SettingsList /> : null}
			{state === "matrix" ? <SwitchMatrix /> : null}
			{state === "sizes" ? <SwitchSizes /> : null}
			{state === "default" ? <SingleSwitches /> : null}
		</div>
	);
}

export const switchExhibit: Exhibit = {
	id: "switch",
	name: "开关",
	units: ["switch"],
	zone: "shelf",
	category: "form",
	footprint: { width: 340, height: 180 },
	states: [
		{ id: "default", label: "独立开关" },
		{ id: "list", label: "设置列表" },
		{ id: "matrix", label: "状态" },
		{ id: "sizes", label: "尺寸" },
	],
	Render: SwitchFamily,
};
