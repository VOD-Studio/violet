import {
	Button,
	Drawer,
	DrawerBody,
	DrawerContent,
	type DrawerContentProps,
	DrawerFooter,
	DrawerHeader,
	type DrawerProps,
	DrawerTitle,
	ListHighlight,
	ListHighlightItem,
	TagToggle,
	Textarea,
} from "@violet/ui";
import { Flag, ImageDown, Link2, MessageCircle, QrCode } from "lucide-react";
import { useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

type DrawerKind = "share" | "filter" | "comment";

/** 抽屉总是模态，陈列态用非模态常开一个，点手机里的按钮打开真正的抽屉。 */
const STATES: { id: DrawerKind; label: string }[] = [
	{ id: "share", label: "随内容" },
	{ id: "filter", label: "半屏与全屏" },
	{ id: "comment", label: "写评论" },
];

const SHARE_ACTIONS = [
	{ label: "复制链接", icon: Link2 },
	{ label: "发到聊天", icon: MessageCircle },
	{ label: "存为图片", icon: ImageDown },
	{ label: "生成二维码", icon: QrCode },
];

const FILTER_GROUPS = [
	{
		name: "标签",
		options: [
			"Go",
			"Rust",
			"前端",
			"骑行",
			"摄影",
			"生活",
			"AI",
			"CSS",
			"数据库",
			"写作",
			"读书",
			"新疆",
		],
	},
	{ name: "状态", options: ["已发布", "草稿", "定时"] },
	{ name: "年份", options: ["2026", "2025", "2024", "2023"] },
	{ name: "系列", options: ["从零写一个博客", "Rust 全栈笔记", "独库公路骑行记"] },
	{ name: "作者", options: ["xunrua", "林间", "Momo", "雾里"] },
];

const COMMENT_LIMIT = 500;

interface DrawerSlotProps {
	container: HTMLElement | null;
	root: DrawerProps;
	content?: Partial<DrawerContentProps>;
}

function ShareDrawer({ container, root, content }: DrawerSlotProps) {
	return (
		<Drawer {...root}>
			<DrawerContent container={container} aria-describedby={undefined} {...content}>
				<DrawerHeader>
					<DrawerTitle>分享</DrawerTitle>
				</DrawerHeader>
				<DrawerBody className="px-2">
					<ListHighlight>
						<ul className="m-0 flex list-none flex-col p-0">
							{SHARE_ACTIONS.map(({ label, icon: Icon }) => (
								<li key={label}>
									<ListHighlightItem>
										<button
											type="button"
											className="flex min-h-11 w-full items-center gap-3.5 rounded-lg bg-transparent px-3 text-14 outline-none"
										>
											<Icon
												className="size-5 text-muted-foreground"
												aria-hidden="true"
											/>
											{label}
										</button>
									</ListHighlightItem>
								</li>
							))}
							<li className="my-1.5 border-border border-t" aria-hidden="true" />
							<li>
								<ListHighlightItem>
									<button
										type="button"
										className="flex min-h-11 w-full items-center gap-3.5 rounded-lg bg-transparent px-3 text-14 text-destructive outline-none"
									>
										<Flag className="size-5" aria-hidden="true" />
										举报
									</button>
								</ListHighlightItem>
							</li>
						</ul>
					</ListHighlight>
				</DrawerBody>
			</DrawerContent>
		</Drawer>
	);
}

function FilterDrawer({ container, root, content }: DrawerSlotProps) {
	const [picked, setPicked] = useState<string[]>(["骑行", "已发布"]);
	const toggle = (option: string, next: boolean) =>
		setPicked((current) =>
			next ? [...current, option] : current.filter((item) => item !== option),
		);
	return (
		<Drawer {...root}>
			<DrawerContent
				container={container}
				snapPoints="half-full"
				aria-describedby={undefined}
				{...content}
			>
				<DrawerHeader>
					<DrawerTitle>筛选</DrawerTitle>
					<Button
						variant="ghost"
						size="sm"
						disabled={picked.length === 0}
						onClick={() => setPicked([])}
					>
						重置
					</Button>
				</DrawerHeader>
				<DrawerBody className="flex flex-col gap-5.5 px-5">
					{FILTER_GROUPS.map((group) => (
						<section key={group.name} aria-label={group.name}>
							<p className="m-0 text-13 text-muted-foreground">{group.name}</p>
							<div className="mt-2.5 flex flex-wrap gap-2">
								{group.options.map((option) => (
									<TagToggle
										key={option}
										pressed={picked.includes(option)}
										onPressedChange={(next) => toggle(option, next)}
									>
										{option}
									</TagToggle>
								))}
							</div>
						</section>
					))}
				</DrawerBody>
				<DrawerFooter>
					<Button>看 {Math.max(1, 24 - picked.length * 3)} 篇</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}

function CommentDrawer({ container, root, content }: DrawerSlotProps) {
	const [text, setText] = useState("");
	return (
		<Drawer {...root}>
			<DrawerContent container={container} aria-describedby={undefined} {...content}>
				<DrawerHeader>
					<DrawerTitle>写评论</DrawerTitle>
					<span className="pr-2 font-mono text-12 text-muted-foreground">
						{text.length} / {COMMENT_LIMIT}
					</span>
				</DrawerHeader>
				<DrawerBody>
					<Textarea
						aria-label="评论内容"
						rows={4}
						maxLength={COMMENT_LIMIT}
						placeholder="说点什么"
						value={text}
						onChange={(event) => setText(event.currentTarget.value)}
					/>
				</DrawerBody>
				<DrawerFooter className="shadow-none">
					<Button disabled={!text.trim()}>发布</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}

const DRAWERS = { share: ShareDrawer, filter: FilterDrawer, comment: CommentDrawer };

/** 手机框里的文章页：三个按钮各打开一种抽屉，按住把手或标题往下拖。 */
function DrawerStage({ state }: ExhibitRenderProps) {
	const kind = STATES.find((item) => item.id === state)?.id ?? "share";
	const { ref, container } = useStageContainer();
	const [resting, setResting] = useState(true);
	const [live, setLive] = useState<DrawerKind | null>(null);
	const Resting = DRAWERS[kind];
	const insideStage = (target: EventTarget | null) =>
		target instanceof Node && container?.contains(target);

	// 陈列中的抽屉不抢焦点，舞台外的点击与 Esc 交还给展厅
	const restingContent: Partial<DrawerContentProps> = {
		onOpenAutoFocus: (event) => event.preventDefault(),
		onEscapeKeyDown: (event) => {
			if (!insideStage(document.activeElement)) event.preventDefault();
		},
		onInteractOutside: (event) => {
			if (!insideStage(event.target)) event.preventDefault();
		},
	};

	const open = (next: DrawerKind) => {
		setResting(false);
		setLive(next);
	};

	return (
		<div className="flex size-full items-start justify-center">
			<div
				ref={ref}
				className="relative h-full w-90 overflow-hidden rounded-2xl bg-background text-foreground outline-1 -outline-offset-1 outline-rule2 contain-layout"
			>
				<div className="flex h-13 items-center justify-between px-4">
					<span className="font-mono text-14 font-bold">Violet</span>
				</div>
				<div className="px-4">
					<span className="font-mono text-12 text-muted-foreground">
						2026-10-12 · 骑行
					</span>
					<h3 className="m-0 mt-1 text-19 font-semibold">独库公路，六天</h3>
					<p className="m-0 mt-3 text-14 leading-relaxed text-foreground/90">
						从独山子出发，第一天就爬升两千米。哈希勒根达坂的风把手套吹透，下坡时手指已经握不住刹车。晚上在乔尔玛的兵站借宿。
					</p>
					<div className="mt-4.5 flex gap-2">
						{STATES.map((item) => (
							<Button
								key={item.id}
								variant="secondary"
								className="h-11 flex-1"
								onClick={() => open(item.id)}
							>
								{{ share: "分享", filter: "筛选", comment: "评论" }[item.id]}
							</Button>
						))}
					</div>
				</div>
				{(Object.keys(DRAWERS) as DrawerKind[]).map((item) => {
					const Live = DRAWERS[item];
					return (
						<Live
							key={item}
							container={container}
							root={{
								open: live === item,
								onOpenChange: (next) => setLive(next ? item : null),
							}}
						/>
					);
				})}
				{resting && (
					<div
						aria-hidden="true"
						data-state="open"
						className="v-scrim v-drawer-overlay"
					/>
				)}
				<Resting
					container={container}
					root={{ open: resting, onOpenChange: setResting, modal: false }}
					content={restingContent}
				/>
			</div>
		</div>
	);
}

export const drawerExhibit: Exhibit = {
	id: "drawer",
	name: "抽屉",
	units: ["drawer"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 360, height: 560 },
	states: STATES.map(({ id, label }) => ({ id, label })),
	Render: (props) => <DrawerStage key={props.state} {...props} />,
};
