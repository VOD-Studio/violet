import {
	Button,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	type DialogContentProps,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	type DialogProps,
	DialogTitle,
	DialogTrigger,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	Input,
	Kbd,
	Label,
	Textarea,
} from "@violet/ui";
import { ChevronDown } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const PROFILE = { nick: "林间", bio: "在杭州写后端，喜欢读别人的博客。", home: "博客" };
const HOMES = ["博客", "手记", "推文"];
const BIO_LIMIT = 80;

const CHANGELOG = [
	[
		"2.22.1",
		"2026-10-30",
		["修复季节插画在窄屏被大幅裁切", "主题设置合成一层面板，季节与明暗放在一起"],
	],
	[
		"2.22.0",
		"2026-10-24",
		["新增实时状态：灵动岛显示正在听的歌", "个人主页横幅支持拖动调整焦点"],
	],
	["2.21.0", "2026-10-15", ["看板与项目路线图", "拖动排序支持键盘：空格拿起，方向键移动"]],
	["2.20.2", "2026-10-09", ["修复评论里的表情和文字没有对齐", "修复深色下代码块行号太亮"]],
	["2.20.0", "2026-10-02", ["文章动画可以导出成视频", "Safari 不支持的格式自动换成 GIF"]],
	["2.19.0", "2026-09-20", ["批注支持多段选区", "后台列表记住每页条数"]],
] as const;

const SHORTCUTS = [
	["打开命令面板", "⌘ K"],
	["批注选中的文字", "⌘ ⇧ M"],
	["切换明暗", "⌘ ⇧ L"],
	["回到顶部", "T"],
] as const;

type DialogKind = "profile" | "changelog" | "shortcuts";

/** 展柜里的陈列态：舞台里常开一个非模态的对话框，点舞台里的按钮会打开真正的模态对话框。 */
const STATES: { id: string; label: string; kind: DialogKind; overlay: boolean }[] = [
	{ id: "profile", label: "表单", kind: "profile", overlay: true },
	{ id: "changelog", label: "长内容滚动", kind: "changelog", overlay: true },
	{ id: "shortcuts", label: "落位", kind: "shortcuts", overlay: true },
	{ id: "clear", label: "无遮罩", kind: "profile", overlay: false },
];

interface DialogSlotProps {
	container: HTMLElement | null;
	overlay: boolean;
	/** 打开它的按钮；省略时为常开的陈列 */
	trigger?: ReactNode;
	root?: DialogProps;
	content?: Partial<DialogContentProps>;
}

function ProfileDialog({ container, overlay, trigger, root, content }: DialogSlotProps) {
	const [nick, setNick] = useState(PROFILE.nick);
	const [bio, setBio] = useState(PROFILE.bio);
	const [home, setHome] = useState(PROFILE.home);
	const [error, setError] = useState(false);
	const [ownOpen, setOwnOpen] = useState(false);
	const open = root?.open ?? ownOpen;
	const nickRef = useRef<HTMLInputElement>(null);
	const dirty = nick !== PROFILE.nick || bio !== PROFILE.bio || home !== PROFILE.home;
	const bioId = useId();

	const reset = () => {
		setNick(PROFILE.nick);
		setBio(PROFILE.bio);
		setHome(PROFILE.home);
		setError(false);
	};
	const changeOpen = (next: boolean) => {
		setOwnOpen(next);
		if (!next) reset();
		root?.onOpenChange?.(next);
	};
	const save = () => {
		if (!nick.trim()) {
			setError(true);
			nickRef.current?.focus();
			return;
		}
		changeOpen(false);
	};

	return (
		<Dialog {...root} open={open} onOpenChange={changeOpen}>
			{trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
			<DialogContent container={container} overlay={overlay} dirty={dirty} {...content}>
				<DialogHeader>
					<DialogTitle>编辑资料</DialogTitle>
					<DialogDescription>名字和简介会显示在你的评论旁边</DialogDescription>
				</DialogHeader>
				<DialogBody className="flex flex-col gap-4">
					<Input
						ref={nickRef}
						label="昵称"
						maxLength={20}
						value={nick}
						invalid={error}
						errorMessage="昵称不能为空"
						onChange={(event) => {
							setNick(event.currentTarget.value);
							setError(false);
						}}
					/>
					<div className="flex flex-col gap-2">
						<Label htmlFor={bioId}>简介</Label>
						<Textarea
							id={bioId}
							rows={2}
							maxLength={BIO_LIMIT}
							value={bio}
							onChange={(event) => setBio(event.currentTarget.value)}
						/>
						<p className="m-0 self-end font-mono text-12 text-muted-foreground">
							{bio.length} / {BIO_LIMIT}
						</p>
					</div>
					<div className="flex items-center justify-between gap-3">
						<span className="text-14 font-semibold">主页先显示</span>
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button variant="secondary" size="sm">
									{home}
									<ChevronDown aria-hidden="true" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent container={container} align="end">
								<DropdownMenuRadioGroup value={home} onValueChange={setHome}>
									{HOMES.map((item) => (
										<DropdownMenuRadioItem key={item} value={item}>
											{item}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</DialogBody>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="secondary">取消</Button>
					</DialogClose>
					<Button onClick={save}>保存</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ChangelogDialog({ container, overlay, trigger, root, content }: DialogSlotProps) {
	return (
		<Dialog {...root}>
			{trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
			<DialogContent container={container} overlay={overlay} {...content}>
				<DialogHeader>
					<DialogTitle>更新日志</DialogTitle>
					<DialogDescription>2.19 以来的改动，从新到旧</DialogDescription>
				</DialogHeader>
				<DialogBody>
					{CHANGELOG.map(([version, date, changes]) => (
						<section
							key={version}
							className="border-border border-t py-3 first:border-t-0 first:pt-1"
						>
							<p className="m-0 flex items-baseline gap-3 font-mono text-13">
								<b className="font-semibold">{version}</b>
								<span className="text-muted-foreground">{date}</span>
							</p>
							<ul className="m-0 mt-1 pl-5 text-14">
								{changes.map((change) => (
									<li key={change}>{change}</li>
								))}
							</ul>
						</section>
					))}
				</DialogBody>
				<DialogFooter>
					<DialogClose asChild>
						<Button>知道了</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** 由快捷键打开：没有按钮可以长出来，落位进场。 */
function ShortcutsDialog({ container, overlay, root, content }: DialogSlotProps) {
	return (
		<Dialog {...root}>
			<DialogContent
				container={container}
				overlay={overlay}
				size="sm"
				entrance="settle"
				aria-describedby={undefined}
				{...content}
			>
				<DialogHeader>
					<DialogTitle>键盘快捷键</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<dl className="m-0">
						{SHORTCUTS.map(([action, keys]) => (
							<div
								key={action}
								className="flex items-center justify-between border-border border-t py-2 text-14 first:border-t-0"
							>
								<dt>{action}</dt>
								<dd className="m-0 flex gap-1">
									{keys.split(" ").map((key) => (
										<Kbd key={key}>{key}</Kbd>
									))}
								</dd>
							</div>
						))}
					</dl>
				</DialogBody>
				<DialogFooter>
					<DialogClose asChild>
						<Button>知道了</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

const DIALOGS = { profile: ProfileDialog, changelog: ChangelogDialog, shortcuts: ShortcutsDialog };

function isEditable(target: EventTarget) {
	return target instanceof HTMLElement && target.closest("input, textarea, [contenteditable]");
}

/** 贴近真实文章页的舞台：两个按钮打开模态对话框，按 ? 打开快捷键说明；常开的那个是非模态陈列。 */
function DialogStage({ state }: ExhibitRenderProps) {
	const current = STATES.find((item) => item.id === state) ?? STATES[0];
	const { ref, container } = useStageContainer();
	const [resting, setResting] = useState(true);
	const [shortcuts, setShortcuts] = useState(false);
	const Resting = DIALOGS[current.kind];
	const insideStage = (target: EventTarget | null) =>
		target instanceof Node && container?.contains(target);

	// 陈列中的对话框不抢焦点、不困住焦点，舞台外的点击与 Esc 交还给展厅
	const restingContent: Partial<DialogContentProps> = {
		onOpenAutoFocus: (event) => event.preventDefault(),
		onEscapeKeyDown: (event) => {
			if (!insideStage(document.activeElement)) event.preventDefault();
		},
		onInteractOutside: (event) => {
			if (!insideStage(event.target)) event.preventDefault();
		},
	};

	const openShortcuts = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "?" || isEditable(event.target)) return;
		event.preventDefault();
		setResting(false);
		setShortcuts(true);
	};

	return (
		// 舞台模拟页面：点空白处也让焦点留在舞台里，页面级快捷键才收得到
		<div
			ref={ref}
			tabIndex={-1}
			className="relative size-full overflow-hidden rounded-xl bg-background text-foreground outline-1 -outline-offset-1 outline-rule2 contain-layout focus:outline-rule2"
			onKeyDown={openShortcuts}
		>
			<div className="flex flex-col gap-1 px-8 pt-8">
				<span className="font-mono text-12 text-muted-foreground">2026-10-12 · 骑行</span>
				<h3 className="m-0 text-22 font-semibold">独库公路，六天</h3>
			</div>
			<div className="mt-4 flex gap-2 px-8">
				<ProfileDialog
					container={container}
					overlay={current.overlay}
					trigger={
						<Button variant="secondary" size="sm" onClick={() => setResting(false)}>
							编辑资料
						</Button>
					}
				/>
				<ChangelogDialog
					container={container}
					overlay={current.overlay}
					trigger={
						<Button variant="secondary" size="sm" onClick={() => setResting(false)}>
							更新日志
						</Button>
					}
				/>
			</div>
			<p className="m-0 mt-5 px-8 text-14 leading-relaxed text-foreground/90">
				从独山子出发，第一天就爬升两千米。哈希勒根达坂的风把手套吹透，下坡时手指已经握不住刹车。晚上在乔尔玛的兵站借宿，老板说明天的雪要等中午才化。
			</p>
			<p className="m-0 mt-3 px-8 text-13 text-muted-foreground">
				按 <Kbd>?</Kbd> 看快捷键
			</p>
			<ShortcutsDialog
				container={container}
				overlay={current.overlay}
				root={{ open: shortcuts, onOpenChange: setShortcuts }}
			/>
			{resting && current.overlay && (
				<div aria-hidden="true" data-state="open" className="v-scrim v-dialog-overlay" />
			)}
			<Resting
				container={container}
				overlay={current.overlay}
				root={{ open: resting, onOpenChange: setResting, modal: false }}
				content={{ ...restingContent, entrance: "settle" }}
			/>
		</div>
	);
}

export const dialogExhibit: Exhibit = {
	id: "dialog",
	name: "对话框",
	units: ["dialog", "confirm-dialog", "prompt-dialog"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 560, height: 440 },
	states: STATES.map(({ id, label }) => ({ id, label })),
	Render: (props) => <DialogStage key={props.state} {...props} />,
};
