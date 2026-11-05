import {
	Button,
	Input,
	Kbd,
	type KbdKey,
	type KbdPlatform,
	KbdSeparator,
	Segmented,
} from "@violet/ui";
import { Search } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const PLATFORMS: { value: KbdPlatform; label: string }[] = [
	{ value: "mac", label: "macOS" },
	{ value: "other", label: "Windows" },
];

const NAMED_KEYS: Record<string, KbdKey> = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
	Enter: "enter",
	Backspace: "backspace",
	Tab: "tab",
	Escape: "esc",
	" ": "space",
};

const MODIFIER_KEYS: Record<string, true> = { Shift: true, Control: true, Alt: true, Meta: true };

/** 把按键事件整理成键帽：macOS 的 ⌘ 与 Windows 的 Ctrl 都落到 mod；字母取物理键，避开 ⌥ 组合出的字符。 */
function captureKeys(event: KeyboardEvent, platform: KbdPlatform): KbdKey[] | null {
	if (Object.hasOwn(MODIFIER_KEYS, event.key)) return null;
	const keys: KbdKey[] = [];
	if (platform === "mac") {
		if (event.ctrlKey) keys.push("ctrl");
		if (event.metaKey) keys.push("mod");
	} else if (event.ctrlKey) {
		keys.push("mod");
	}
	if (event.altKey) keys.push("alt");
	if (event.shiftKey) keys.push("shift");
	if (event.code.startsWith("Key")) keys.push(event.code.slice(3));
	else if (event.code.startsWith("Digit")) keys.push(event.code.slice(5));
	else keys.push(NAMED_KEYS[event.key] ?? (event.key.length === 1 ? event.key : event.code));
	return keys;
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs text-muted-foreground">{label}</span>
			<div className="flex min-h-10 items-center">{children}</div>
		</div>
	);
}

function Forms() {
	return (
		<div className="grid grid-cols-2 gap-x-8 gap-y-4">
			<Cell label="单键">
				<span className="flex items-center gap-2">
					<Kbd>Esc</Kbd>
					<Kbd>/</Kbd>
					<Kbd>?</Kbd>
				</span>
			</Cell>
			<Cell label="组合键">
				<Kbd keys={["mod", "K"]} />
			</Cell>
			<Cell label="可选键">
				<span className="flex items-center gap-1">
					<Kbd keys={["up"]} />
					<Kbd keys={["down"]} />
					<KbdSeparator>或</KbdSeparator>
					<Kbd>J</Kbd>
					<Kbd>K</Kbd>
				</span>
			</Cell>
			<Cell label="先后按">
				<Kbd>G</Kbd>
				<KbdSeparator>然后</KbdSeparator>
				<Kbd>H</Kbd>
			</Cell>
			<Cell label="放在控件里">
				<Input
					aria-label="搜索"
					placeholder="搜索"
					leading={<Search aria-hidden="true" />}
					trailing={<Kbd variant="light" keys={["mod", "K"]} />}
				/>
			</Cell>
			<Cell label="放在按钮里">
				<Button variant="secondary">
					发布
					<Kbd variant="onButton" size="sm" keys={["mod", "enter"]} />
				</Button>
			</Cell>
		</div>
	);
}

function Sizes() {
	return (
		<div className="flex items-end gap-12">
			<Cell label="小 · 20">
				<Kbd size="sm" keys={["mod", "K"]} />
			</Cell>
			<Cell label="中 · 24">
				<Kbd size="md" keys={["mod", "K"]} />
			</Cell>
			<Cell label="大 · 28">
				<Kbd size="lg" keys={["mod", "K"]} />
			</Cell>
		</div>
	);
}

function PlatformPicker({
	platform,
	onChange,
}: {
	platform: KbdPlatform;
	onChange: (platform: KbdPlatform) => void;
}) {
	return (
		<Segmented
			aria-label="平台"
			value={platform}
			onValueChange={onChange}
			segments={PLATFORMS}
		/>
	);
}

function Platforms() {
	const [platform, setPlatform] = useState<KbdPlatform>("mac");
	return (
		<div className="flex flex-col items-start gap-4">
			<PlatformPicker platform={platform} onChange={setPlatform} />
			<dl className="m-0 grid w-full grid-cols-[1fr_auto] items-center">
				<dt className="flex min-h-9 items-center text-sm">搜索</dt>
				<dd className="m-0 flex items-center">
					<Kbd platform={platform} keys={["mod", "K"]} />
				</dd>
				<dt className="flex min-h-9 items-center text-sm">命令面板</dt>
				<dd className="m-0 flex items-center">
					<Kbd platform={platform} keys={["mod", "shift", "P"]} />
				</dd>
				<dt className="flex min-h-9 items-center text-sm">上一篇 / 下一篇</dt>
				<dd className="m-0 flex items-center">
					<Kbd platform={platform}>J</Kbd>
					<KbdSeparator>或</KbdSeparator>
					<Kbd platform={platform}>K</Kbd>
				</dd>
				<dt className="flex min-h-9 items-center text-sm">保存草稿</dt>
				<dd className="m-0 flex items-center">
					<Kbd platform={platform} keys={["ctrl", "alt", "S"]} />
				</dd>
			</dl>
		</div>
	);
}

function TryIt() {
	const [platform, setPlatform] = useState<KbdPlatform>("mac");
	const [keys, setKeys] = useState<KbdKey[]>([]);

	const capture = (event: KeyboardEvent<HTMLInputElement>) => {
		// Tab 与 Esc 单独按下时放行，键盘用户才能离开输入框
		if (
			!(event.ctrlKey || event.metaKey || event.altKey) &&
			(event.key === "Tab" || event.key === "Escape")
		) {
			return;
		}
		// 浏览器自己的组合键（⌘W、Ctrl+S 等）拦不住，这里也不拦
		if (!(event.ctrlKey || event.metaKey)) event.preventDefault();
		const captured = captureKeys(event, platform);
		if (captured) setKeys(captured);
	};

	return (
		<div className="flex flex-col items-center gap-4">
			<div className="w-65">
				<Input
					readOnly
					aria-label="按下快捷键"
					placeholder="点这里，然后按键"
					description="Tab 与 Esc 用来离开输入框"
					onKeyDown={capture}
				/>
			</div>
			<output className="flex min-h-8 items-center" aria-live="polite">
				{keys.length > 0 ? (
					<Kbd size="lg" platform={platform} keys={keys} />
				) : (
					<span className="text-xs text-muted-foreground">还没有按键</span>
				)}
			</output>
			<PlatformPicker
				platform={platform}
				onChange={(next) => {
					setPlatform(next);
					setKeys([]);
				}}
			/>
		</div>
	);
}

function KbdFamily({ state }: ExhibitRenderProps) {
	if (state === "sizes") return <Sizes />;
	if (state === "platform") return <Platforms />;
	if (state === "try") return <TryIt />;
	return <Forms />;
}

export const kbdExhibit: Exhibit = {
	id: "kbd",
	name: "键帽",
	units: ["kbd"],
	zone: "shelf",
	category: "display",
	footprint: { width: 480, height: 224 },
	states: [
		{ id: "forms", label: "形态" },
		{ id: "sizes", label: "尺寸" },
		{ id: "platform", label: "平台" },
		{ id: "try", label: "试一试" },
	],
	Render: KbdFamily,
};
