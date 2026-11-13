import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	MorphingPopover,
	MorphingPopoverAnchor,
	MorphingPopoverContent,
	type MorphingPopoverProps,
	MorphingPopoverTrigger,
} from "..";

function Status({ name = "状态", ...props }: { name?: string } & MorphingPopoverProps) {
	return (
		<MorphingPopover {...props}>
			<MorphingPopoverTrigger asChild>
				<button type="button">{name}</button>
			</MorphingPopoverTrigger>
			<MorphingPopoverContent aria-label={`${name}详情`}>
				<button type="button">刷新</button>
			</MorphingPopoverContent>
		</MorphingPopover>
	);
}

const trigger = (name = "状态") => screen.getByRole("button", { name });
const panel = () => screen.queryByRole("dialog");
const open = (name?: string) => fireEvent.click(trigger(name));
/** 外部按下监听在打开之后才登记；等一个宏任务再按。 */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe("MorphingPopover", () => {
	afterEach(cleanup);

	it("关闭时只有触发器，读屏得知它可展开且当前未展开", () => {
		render(<Status />);
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
		expect(panel()).toBeNull();
	});

	it("点触发器展开：面板是以 aria-label 命名的 dialog，触发器的 aria-controls 指向它", () => {
		render(<Status />);
		open();

		const dialog = screen.getByRole("dialog", { name: "状态详情" });
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
		expect(trigger().getAttribute("aria-controls")).toBe(dialog.id);
		expect(dialog.id).not.toBe("");
	});

	it("再点一次触发器收起：退场结束后面板卸载，焦点回到触发器", async () => {
		render(<Status />);
		open();
		act(() => screen.getByRole("button", { name: "刷新" }).focus());

		fireEvent.click(trigger());
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(trigger());
	});

	it("Esc 收起，焦点回到触发器", async () => {
		render(<Status />);
		open();
		act(() => screen.getByRole("button", { name: "刷新" }).focus());

		fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(trigger());
	});

	it("点面板外面收起，点面板里面不收起", async () => {
		render(
			<>
				<Status />
				<p>页面正文</p>
			</>,
		);
		open();
		await settle();

		fireEvent.pointerDown(screen.getByRole("button", { name: "刷新" }));
		expect(trigger().getAttribute("aria-expanded")).toBe("true");

		fireEvent.pointerDown(screen.getByText("页面正文"));
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
		await waitFor(() => expect(panel()).toBeNull());
	});

	describe("焦点", () => {
		it("展开后焦点进入面板里第一个可聚焦控件", () => {
			render(<Status />);
			open();
			expect(document.activeElement).toBe(screen.getByRole("button", { name: "刷新" }));
		});

		it("面板里没有可聚焦控件时，焦点落在面板本身", () => {
			render(
				<MorphingPopover>
					<MorphingPopoverTrigger asChild>
						<button type="button">状态</button>
					</MorphingPopoverTrigger>
					<MorphingPopoverContent aria-label="状态详情">
						只读的说明
					</MorphingPopoverContent>
				</MorphingPopover>,
			);
			open();
			expect(document.activeElement).toBe(screen.getByRole("dialog"));
		});

		it("焦点移到根之外的元素时收起，焦点留在那里", async () => {
			render(
				<>
					<Status />
					<button type="button">其他</button>
				</>,
			);
			open();
			act(() => screen.getByRole("button", { name: "其他" }).focus());

			expect(trigger().getAttribute("aria-expanded")).toBe("false");
			expect(document.activeElement).toBe(screen.getByRole("button", { name: "其他" }));
			await waitFor(() => expect(panel()).toBeNull());
		});

		it("展开期间触发器被面板盖住，不再占 Tab 停靠位", async () => {
			render(<Status />);
			expect(trigger().hasAttribute("tabindex")).toBe(false);

			open();
			expect(trigger().getAttribute("tabindex")).toBe("-1");

			fireEvent.click(trigger());
			await waitFor(() => expect(trigger().hasAttribute("tabindex")).toBe(false));
		});
	});

	describe("状态归属", () => {
		it("受控：点触发器只报告意图，展开与否由 open 决定", () => {
			const onOpenChange = vi.fn();
			const { rerender } = render(<Status open={false} onOpenChange={onOpenChange} />);

			open();
			expect(onOpenChange).toHaveBeenCalledWith(true);
			expect(panel()).toBeNull();

			rerender(<Status open onOpenChange={onOpenChange} />);
			expect(panel()).not.toBeNull();
			expect(trigger().getAttribute("aria-expanded")).toBe("true");
		});

		it("defaultOpen 一开始就展开", () => {
			render(<Status defaultOpen />);
			expect(panel()).not.toBeNull();
			expect(trigger().getAttribute("aria-expanded")).toBe("true");
		});

		it("同一时刻只展开一个：打开另一个时前一个收起", async () => {
			render(
				<>
					<Status name="状态" />
					<Status name="回应" />
				</>,
			);
			open("状态");
			open("回应");

			expect(trigger("回应").getAttribute("aria-expanded")).toBe("true");
			expect(trigger("状态").getAttribute("aria-expanded")).toBe("false");
			await waitFor(() =>
				expect(screen.queryByRole("dialog", { name: "状态详情" })).toBeNull(),
			);
		});
	});

	describe("读屏", () => {
		it("面板角色可按内容改成 listbox", () => {
			render(
				<MorphingPopover>
					<MorphingPopoverTrigger asChild>
						<button type="button">添加回应</button>
					</MorphingPopoverTrigger>
					<MorphingPopoverContent role="listbox" aria-label="回应">
						<button type="button" role="option" aria-selected="false">
							👍
						</button>
					</MorphingPopoverContent>
				</MorphingPopover>,
			);
			open("添加回应");
			expect(screen.getByRole("listbox", { name: "回应" })).not.toBeNull();
			expect(panel()).toBeNull();
		});

		it("没有传 aria-label 时以触发器命名面板", () => {
			render(
				<MorphingPopover>
					<MorphingPopoverTrigger asChild>
						<button type="button">实时状态</button>
					</MorphingPopoverTrigger>
					<MorphingPopoverContent>内容</MorphingPopoverContent>
				</MorphingPopover>,
			);
			open("实时状态");
			expect(screen.getByRole("dialog", { name: "实时状态" })).not.toBeNull();
		});
	});
});

/** 触发器 120×36 的胶囊；面板 380×240，固定触发器的左上角。 */
const TRIGGER_BOX = new DOMRect(100, 40, 120, 36);
const PANEL_BOX = new DOMRect(100, 40, 380, 240);
/** 触发器在面板里的外形：上 0、右 380-120、下 240-36、左 0，圆角取短边的一半。 */
const FROM_TRIGGER = "inset(0px 260px 204px 0px round 18px)";
const FULL = "inset(0px 0px 0px 0px round 16px)";

interface Track {
	target: Element;
	keyframes: Keyframe[];
	options: KeyframeAnimationOptions;
	animation: { playState: string; finish: () => void };
}

/** jsdom 没有 Web Animations：用替身记录每一段动画，并由测试决定何时播完。 */
function stubWaapi() {
	const tracks: Track[] = [];
	const animate = vi.fn(function (
		this: Element,
		keyframes: Keyframe[],
		options: KeyframeAnimationOptions,
	) {
		let settle: (value: unknown) => void = () => {};
		let fail: (reason: unknown) => void = () => {};
		const finished = new Promise((resolve, reject) => {
			settle = resolve;
			fail = reject;
		});
		const animation = {
			playState: "running",
			finished,
			finish() {
				animation.playState = "finished";
				settle(animation);
			},
			cancel() {
				if (animation.playState !== "running") return;
				animation.playState = "idle";
				fail(new DOMException("动画被取消", "AbortError"));
			},
		};
		tracks.push({ target: this, keyframes, options, animation });
		return animation;
	});
	Object.defineProperty(Element.prototype, "animate", {
		value: animate,
		configurable: true,
		writable: true,
	});
	return {
		animate,
		tracks,
		/** 面板外形（clip-path）的那几段，按出现顺序。 */
		shape: () =>
			tracks.filter(
				(track) =>
					track.target.getAttribute("data-slot") === "morphing-popover-content" &&
					track.keyframes.some((frame) => frame.clipPath !== undefined),
			),
	};
}

/** `panels` 按面板的 aria-label 给出各自的尺寸，其余面板用 PANEL_BOX；`triggerBox` 是触发器的位置。 */
function stubGeometry(
	panels: Record<string, DOMRect> = {},
	triggerBox = TRIGGER_BOX,
	anchorBox = new DOMRect(100, 40, 180, 40),
) {
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
		this: HTMLElement,
	) {
		const slot = this.getAttribute("data-slot");
		if (slot === "morphing-popover-anchor") return anchorBox;
		if (slot === "morphing-popover-trigger") return triggerBox;
		if (slot === "morphing-popover-content") {
			return panels[this.getAttribute("aria-label") ?? ""] ?? PANEL_BOX;
		}
		return new DOMRect(0, 0, 0, 0);
	});
}

describe("MorphingPopover 外形", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		Reflect.deleteProperty(Element.prototype, "animate");
	});

	it("展开时外形从触发器的位置、大小与圆角长到整块面板", () => {
		const waapi = stubWaapi();
		stubGeometry();
		render(<Status />);
		open();

		const [expand] = waapi.shape();
		expect(expand.keyframes.map((frame) => frame.clipPath)).toEqual([FROM_TRIGGER, FULL]);
	});

	it("展开只播一次：内容晚 140ms、软影晚 260ms，各走各的时间", () => {
		const waapi = stubWaapi();
		stubGeometry();
		render(<Status />);
		open();

		expect(waapi.shape()).toHaveLength(1);
		const delayOf = (className: string) =>
			waapi.tracks
				.filter((track) => track.target.classList.contains(className))
				.map((track) => track.options.delay);
		expect(delayOf("v-morph__body")).toEqual([140]);
		expect(delayOf("v-morph__shadow")).toEqual([260]);
	});
	it("收起时外形缩回触发器，缩完才卸载面板", async () => {
		const waapi = stubWaapi();
		stubGeometry();
		render(<Status />);
		open();
		waapi.shape()[0].animation.finish();

		fireEvent.click(trigger());
		const collapse = waapi.shape().at(-1) as Track;
		expect(collapse.keyframes.at(-1)?.clipPath).toBe(FROM_TRIGGER);
		expect(panel()).not.toBeNull();

		act(() => collapse.animation.finish());
		await waitFor(() => expect(panel()).toBeNull());
	});

	it("开启减弱动态时不做变形，面板直接淡入淡出", async () => {
		const waapi = stubWaapi();
		stubGeometry();
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("prefers-reduced-motion"),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}));
		render(<Status />);
		open();
		expect(waapi.animate).not.toHaveBeenCalled();

		fireEvent.click(trigger());
		expect(panel()?.getAttribute("data-state")).toBe("closed");
		await waitFor(() => expect(panel()).toBeNull());
		expect(waapi.animate).not.toHaveBeenCalled();
	});
});

/** 播放中的计算值由浏览器给出；替身让面板、内容与软影都停在一个中间状态。 */
const MID_CLIP = "inset(10px 20px 30px 40px round 17px)";
/** 动画播放中浏览器给出的插值底色；引擎只原样透传，用不透明的占位串断言。 */
const MID_COLOR = "mid-flight-color";
function stubMidFlight(clip = MID_CLIP) {
	const real = window.getComputedStyle.bind(window);
	vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element) => {
		const style = real(element);
		if (!(element instanceof HTMLElement) || !element.className.startsWith("v-morph__"))
			return style;
		return new Proxy(style, {
			get(target, key) {
				if (key === "clipPath") return clip;
				if (key === "backgroundColor") return MID_COLOR;
				if (key === "opacity") return "0.5";
				const value = Reflect.get(target, key);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
	});
}

describe("MorphingPopover 打断", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		Reflect.deleteProperty(Element.prototype, "animate");
	});

	it("展开到一半收起：从当前形状收回，不跳回触发器的外形", () => {
		const waapi = stubWaapi();
		stubGeometry();
		render(<Status />);
		open();
		stubMidFlight();

		fireEvent.click(trigger());
		const collapse = waapi.shape().at(-1) as Track;
		expect(collapse.keyframes[0]).toMatchObject({
			clipPath: MID_CLIP,
			backgroundColor: MID_COLOR,
		});
		expect(collapse.keyframes.at(-1)?.clipPath).toBe(FROM_TRIGGER);
	});

	it("收起到一半再点触发器：从当前形状再长出来，面板不被卸载", async () => {
		const waapi = stubWaapi();
		stubGeometry();
		render(<Status />);
		open();
		fireEvent.click(trigger());
		stubMidFlight();

		fireEvent.click(trigger());
		const regrow = waapi.shape().at(-1) as Track;
		expect(regrow.keyframes[0].clipPath).toBe(MID_CLIP);
		expect(regrow.keyframes.at(-1)?.clipPath).toBe(FULL);
		await settle();
		expect(panel()).not.toBeNull();
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
	});
});

/** 表情条（312×40，圆角 20）接力成完整面板（328×240）：两块面板的左上角都在触发器左上角外扩 6px 处。 */
const TRAY_BOX = new DOMRect(94, 34, 312, 40);
const PICKER_BOX = new DOMRect(94, 34, 328, 240);

function Reaction() {
	const [step, setStep] = useState<"tray" | "picker">("tray");
	return (
		<MorphingPopover>
			<MorphingPopoverTrigger asChild>
				<button type="button">添加回应</button>
			</MorphingPopoverTrigger>
			{step === "tray" ? (
				<MorphingPopoverContent
					key="tray"
					role="listbox"
					aria-label="回应"
					radius={20}
					outset={6}
					ghost={<span>添加副本</span>}
				>
					<button type="button" onClick={() => setStep("picker")}>
						更多表情
					</button>
				</MorphingPopoverContent>
			) : (
				<MorphingPopoverContent
					key="picker"
					aria-label="选择表情"
					outset={6}
					ghost={<span>表情条副本</span>}
				>
					<button type="button">😀</button>
				</MorphingPopoverContent>
			)}
		</MorphingPopover>
	);
}

describe("MorphingPopover 接力", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		Reflect.deleteProperty(Element.prototype, "animate");
	});

	function relayed() {
		const waapi = stubWaapi();
		stubGeometry({ 回应: TRAY_BOX, 选择表情: PICKER_BOX });
		render(<Reaction />);
		open("添加回应");
		waapi.shape()[0].animation.finish();
		fireEvent.click(screen.getByRole("button", { name: "更多表情" }));
		return waapi;
	}

	it("同一个根里换一块面板：新面板立即取代旧面板，从旧面板的外形长出，触发器全程保持展开", () => {
		const waapi = relayed();

		expect(screen.queryByRole("listbox", { name: "回应" })).toBeNull();
		expect(screen.getByRole("dialog", { name: "选择表情" })).not.toBeNull();
		expect(trigger("添加回应").getAttribute("aria-expanded")).toBe("true");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "😀" }));

		const relay = waapi.shape().at(-1) as Track;
		expect(relay.keyframes.map((frame) => frame.clipPath)).toEqual([
			"inset(0px 16px 200px 0px round 20px)",
			FULL,
		]);
	});

	it("从接力后的面板关闭，直接缩回最初的触发器", async () => {
		const waapi = relayed();

		fireEvent.click(trigger("添加回应"));
		const collapse = waapi.shape().at(-1) as Track;
		// 面板 (94,34) 328×240，触发器 (100,40) 120×36：右 422-220=202，下 274-76=198
		expect(collapse.keyframes.at(-1)?.clipPath).toBe("inset(6px 202px 198px 6px round 18px)");

		act(() => collapse.animation.finish());
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("旧面板还在长（弹簧过冲，内缩为负）时接力：新面板从它此刻看得见的外形开始", () => {
		const waapi = stubWaapi();
		stubGeometry({ 回应: TRAY_BOX, 选择表情: PICKER_BOX });
		render(<Reaction />);
		open("添加回应");
		// 表情条 (94,34) 312×40 此刻看得见的是 (95,36) 314×34，圆角 15
		stubMidFlight("inset(2px -3px 4px 1px round 15px)");

		fireEvent.click(screen.getByRole("button", { name: "更多表情" }));
		// 在完整面板 (94,34) 328×240 里：上 2、右 422-409=13、下 274-70=204、左 1
		const relay = waapi.shape().at(-1) as Track;
		expect(relay.keyframes[0].clipPath).toBe("inset(2px 13px 204px 1px round 15px)");
	});
});

const layerOf = (role = "dialog") =>
	screen.getByRole(role).closest(".v-morph__layer") as HTMLElement;

describe("MorphingPopover 锚点", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		Reflect.deleteProperty(Element.prototype, "animate");
	});

	it("默认固定触发器的左上角，朝右下长", () => {
		stubGeometry();
		render(<Status />);
		open();
		expect(layerOf().dataset.anchor).toBe("top left");
	});

	it("右侧放不下就固定右上角，朝左长", () => {
		stubGeometry({}, new DOMRect(900, 40, 120, 36));
		render(<Status />);
		open();
		expect(layerOf().dataset.anchor).toBe("top right");
	});

	it("触发器贴着右下角时固定右下角，朝左上长", () => {
		stubGeometry({}, new DOMRect(900, 700, 120, 36));
		render(<Status />);
		open();
		expect(layerOf().dataset.anchor).toBe("bottom right");
	});

	it("接力的面板沿用原锚点，即使它自己会选别的角", () => {
		stubGeometry(
			{ 回应: new DOMRect(694, 34, 312, 40), 选择表情: new DOMRect(694, 34, 328, 240) },
			new DOMRect(700, 40, 120, 36),
		);
		render(<Reaction />);
		open("添加回应");
		expect(layerOf("listbox").dataset.anchor).toBe("top left");

		fireEvent.click(screen.getByRole("button", { name: "更多表情" }));
		expect(layerOf().dataset.anchor).toBe("top left");
	});
});

describe("MorphingPopover 幽灵副本", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		Reflect.deleteProperty(Element.prototype, "animate");
	});

	function WithGhost() {
		return (
			<MorphingPopover>
				<MorphingPopoverTrigger asChild>
					<button type="button">状态</button>
				</MorphingPopoverTrigger>
				<MorphingPopoverContent aria-label="状态详情" ghost={<span>状态标签</span>}>
					<button type="button">刷新</button>
				</MorphingPopoverContent>
			</MorphingPopover>
		);
	}
	const ghostOf = (text: string) =>
		screen.getByText(text).closest(".v-morph__ghost") as HTMLElement;

	it("副本对读屏隐藏，也不抢走焦点", () => {
		stubGeometry();
		render(<WithGhost />);
		open();
		expect(ghostOf("状态标签").getAttribute("aria-hidden")).toBe("true");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "刷新" }));
	});

	it("副本就落在触发器原来的位置，点它收起", () => {
		stubGeometry();
		render(<WithGhost />);
		open();
		const ghost = ghostOf("状态标签");
		expect([ghost.style.left, ghost.style.top, ghost.style.width, ghost.style.height]).toEqual([
			"0px",
			"0px",
			"120px",
			"36px",
		]);

		fireEvent.click(ghost);
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
	});

	it("展开时副本模糊淡出，收起时最后浮现", () => {
		const waapi = stubWaapi();
		stubGeometry();
		render(<WithGhost />);
		open();
		const ghost = ghostOf("状态标签");
		const onGhost = () => waapi.tracks.filter((track) => track.target === ghost);
		expect(onGhost().map((track) => track.keyframes.map((frame) => frame.opacity))).toEqual([
			[1, 0],
		]);

		fireEvent.click(trigger());
		const back = onGhost().at(-1) as Track;
		expect(back.keyframes.at(-1)?.opacity).toBe(1);
		expect(back.options.delay).toBe(110);
	});

	it("接力的副本是旧面板：落在旧面板的位置，点它不收起，收起时也不再浮现", () => {
		const waapi = stubWaapi();
		stubGeometry({
			回应: new DOMRect(94, 34, 312, 40),
			选择表情: new DOMRect(94, 34, 328, 240),
		});
		render(<Reaction />);
		open("添加回应");
		fireEvent.click(screen.getByRole("button", { name: "更多表情" }));

		const ghost = ghostOf("表情条副本");
		expect([ghost.style.left, ghost.style.top, ghost.style.width, ghost.style.height]).toEqual([
			"0px",
			"0px",
			"312px",
			"40px",
		]);
		fireEvent.click(ghost);
		expect(trigger("添加回应").getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(trigger("添加回应"));
		const returns = waapi.tracks.filter(
			(track) => track.target === ghost && track.keyframes.at(-1)?.opacity === 1,
		);
		expect(returns).toEqual([]);
	});
});

describe("MorphingPopover Esc", () => {
	afterEach(cleanup);

	it("常驻的浮层在文档捕获阶段先吃掉 Esc（preventDefault）时，仍能收起", async () => {
		// 站点根上常驻的 Radix 层就是这样：每个 Esc 都被它先标记为 defaultPrevented
		const swallow = (event: KeyboardEvent) => event.preventDefault();
		document.addEventListener("keydown", swallow, true);
		try {
			render(<Status />);
			open();
			fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
			expect(trigger().getAttribute("aria-expanded")).toBe("false");
			await waitFor(() => expect(panel()).toBeNull());
		} finally {
			document.removeEventListener("keydown", swallow, true);
		}
	});
});

describe("MorphingPopover 审查补充", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		Reflect.deleteProperty(Element.prototype, "animate");
	});

	it("服务端首帧默认展开：面板以触发器命名，aria-controls 指向面板", () => {
		const html = renderToString(
			<MorphingPopover defaultOpen>
				<MorphingPopoverTrigger asChild>
					<button type="button">实时状态</button>
				</MorphingPopoverTrigger>
				<MorphingPopoverContent>内容</MorphingPopoverContent>
			</MorphingPopover>,
		);
		const doc = new DOMParser().parseFromString(html, "text/html");
		const button = doc.querySelector("button") as HTMLElement;
		const dialog = doc.querySelector('[role="dialog"]') as HTMLElement;
		expect(button.id).not.toBe("");
		expect(dialog.getAttribute("aria-labelledby")).toBe(button.id);
		expect(button.getAttribute("aria-controls")).toBe(dialog.id);
	});

	it("面板里 tabindex=-1 的控件不抢初始焦点，焦点落在第一个能 Tab 到的控件", () => {
		render(
			<MorphingPopover>
				<MorphingPopoverTrigger asChild>
					<button type="button">状态</button>
				</MorphingPopoverTrigger>
				<MorphingPopoverContent aria-label="回应">
					<button type="button" tabIndex={-1}>
						跳过
					</button>
					<button type="button">落点</button>
				</MorphingPopoverContent>
			</MorphingPopover>,
		);
		open();
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "落点" }));
	});

	it("展开之后才开启减弱动态：收起不再播放变形，直接淡出", async () => {
		const waapi = stubWaapi();
		stubGeometry();
		render(<Status />);
		open();
		const played = waapi.animate.mock.calls.length;

		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("prefers-reduced-motion"),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}));
		fireEvent.click(trigger());
		expect(waapi.animate).toHaveBeenCalledTimes(played);
		await waitFor(() => expect(panel()).toBeNull());
	});

	it("没传 ghost 时，触发器原来的位置同样点一下收起", () => {
		stubGeometry();
		render(<Status />);
		open();
		const origin = screen.getByRole("dialog").querySelector(".v-morph__ghost") as HTMLElement;
		expect(origin).not.toBeNull();

		fireEvent.click(origin);
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
	});

	it("收起途中点面板：从当前形状再长出来，面板不被卸载", async () => {
		const waapi = stubWaapi();
		stubGeometry();
		render(<Status />);
		open();
		fireEvent.click(trigger());
		stubMidFlight();

		// 收起时面板压在触发器上，指针点到的是面板，不是被盖住的触发器
		fireEvent.click(screen.getByRole("dialog"));
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
		const regrow = waapi.shape().at(-1) as Track;
		expect(regrow.keyframes[0].clipPath).toBe(MID_CLIP);
		await settle();
		expect(panel()).not.toBeNull();
	});
});

function CompositeStatus(props: MorphingPopoverProps) {
	const [selected, setSelected] = useState("外观");
	return (
		<MorphingPopover {...props}>
			<MorphingPopoverAnchor asChild>
				<div data-testid="composite-anchor">
					{["外观", "通知", "账户"].map((name) => (
						<MorphingPopoverTrigger key={name} onClick={() => setSelected(name)}>
							{name}
						</MorphingPopoverTrigger>
					))}
				</div>
			</MorphingPopoverAnchor>
			<MorphingPopoverContent key={selected} aria-label={`${selected}面板`}>
				<button type="button" onClick={() => setSelected("详情")}>
					详情
				</button>
			</MorphingPopoverContent>
		</MorphingPopover>
	);
}

describe("MorphingPopover 整枚胶囊", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		Reflect.deleteProperty(Element.prototype, "animate");
	});

	it("多个按钮共享面板且 ID 唯一，服务端不生成嵌套按钮", () => {
		const html = renderToString(<CompositeStatus defaultOpen />);
		const doc = new DOMParser().parseFromString(html, "text/html");
		const buttons = Array.from(doc.querySelectorAll('[data-slot="morphing-popover-trigger"]'));
		const dialog = doc.querySelector('[role="dialog"]');
		expect(buttons).toHaveLength(3);
		expect(new Set(buttons.map((button) => button.id)).size).toBe(3);
		expect(buttons.every((button) => button.getAttribute("aria-controls") === dialog?.id)).toBe(
			true,
		);
		expect(doc.querySelector("button button")).toBeNull();
		expect(
			doc.querySelector('[data-slot="morphing-popover-anchor"]')?.hasAttribute("inert"),
		).toBe(true);
	});

	it("受控 open 尚未接受打开请求时，整枚胶囊保持可见和可操作", () => {
		const onOpenChange = vi.fn();
		render(<CompositeStatus open={false} onOpenChange={onOpenChange} />);
		fireEvent.click(screen.getByRole("button", { name: "通知" }));
		expect(onOpenChange).toHaveBeenCalledWith(true);
		const anchor = screen.getByTestId("composite-anchor");
		expect(anchor.hasAttribute("inert")).toBe(false);
		expect(anchor.hasAttribute("data-hidden")).toBe(false);
		expect(panel()).toBeNull();
	});

	it("外形从整个 Anchor 长出并缩回，退场结束才恢复胶囊和实际触发按钮焦点", async () => {
		const waapi = stubWaapi();
		stubGeometry();
		render(<CompositeStatus />);
		const notification = screen.getByRole("button", { name: "通知" });
		const anchor = screen.getByTestId("composite-anchor");
		fireEvent.click(notification);
		expect(waapi.shape()[0].keyframes[0].clipPath).toBe(
			"inset(0px 200px 200px 0px round 20px)",
		);
		expect(anchor.hasAttribute("inert")).toBe(true);
		expect(anchor.hasAttribute("data-hidden")).toBe(true);
		fireEvent.keyDown(document, { key: "Escape" });
		const collapse = waapi.shape().at(-1) as Track;
		expect(collapse.keyframes.at(-1)?.clipPath).toBe("inset(0px 200px 200px 0px round 20px)");
		expect(anchor.hasAttribute("inert")).toBe(true);
		expect(document.activeElement).not.toBe(notification);
		act(() => collapse.animation.finish());
		await waitFor(() => expect(panel()).toBeNull());
		expect(anchor.hasAttribute("inert")).toBe(false);
		expect(anchor.hasAttribute("data-hidden")).toBe(false);
		expect(document.activeElement).toBe(notification);
	});

	it("preventDefault 取消默认开关但不取消实际触发按钮登记", async () => {
		function Controlled() {
			const [open, setOpen] = useState(false);
			return (
				<MorphingPopover open={open} onOpenChange={setOpen}>
					<MorphingPopoverAnchor>
						<MorphingPopoverTrigger>外观</MorphingPopoverTrigger>
						<MorphingPopoverTrigger asChild>
							<button
								type="button"
								onClick={(event) => {
									event.preventDefault();
									setOpen(true);
								}}
							>
								通知
							</button>
						</MorphingPopoverTrigger>
						<MorphingPopoverTrigger>账户</MorphingPopoverTrigger>
					</MorphingPopoverAnchor>
					<MorphingPopoverContent>内容</MorphingPopoverContent>
				</MorphingPopover>
			);
		}
		render(<Controlled />);
		const notification = screen.getByRole("button", { name: "通知" });
		fireEvent.click(notification);
		expect(screen.getByRole("dialog", { name: "通知" })).not.toBeNull();
		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(notification);
	});

	it.each([
		"通知",
		"账户",
	])("inline callback ref 重组后仍以实际点击的%s命名并归还焦点", async (name) => {
		const attached = new Map<string, HTMLButtonElement>();
		function WithInlineRefs() {
			const [selected, setSelected] = useState("外观");
			return (
				<MorphingPopover>
					<MorphingPopoverAnchor>
						{["外观", "通知", "账户"].map((label) => (
							<MorphingPopoverTrigger
								key={label}
								ref={(node) => {
									if (node) attached.set(label, node);
									else attached.delete(label);
								}}
								onClick={() => setSelected(label)}
							>
								{label}
							</MorphingPopoverTrigger>
						))}
					</MorphingPopoverAnchor>
					<MorphingPopoverContent key={selected}>当前：{selected}</MorphingPopoverContent>
				</MorphingPopover>
			);
		}
		render(<WithInlineRefs />);
		const clicked = screen.getByRole("button", { name });
		fireEvent.click(clicked);
		expect(attached.get(name)).toBe(clicked);
		expect(screen.getByRole("dialog", { name }).getAttribute("aria-labelledby")).toBe(
			clicked.id,
		);
		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(clicked);
	});

	it("实际卸载触发器时解除登记，不再以已删除按钮命名面板", () => {
		function RemovableTrigger() {
			const [visible, setVisible] = useState(true);
			return (
				<MorphingPopover>
					<MorphingPopoverAnchor>
						<MorphingPopoverTrigger>外观</MorphingPopoverTrigger>
						{visible && <MorphingPopoverTrigger>通知</MorphingPopoverTrigger>}
					</MorphingPopoverAnchor>
					<MorphingPopoverContent>
						<button type="button" onClick={() => setVisible(false)}>
							移除通知入口
						</button>
					</MorphingPopoverContent>
				</MorphingPopover>
			);
		}
		render(<RemovableTrigger />);
		const notification = screen.getByRole("button", { name: "通知" });
		fireEvent.click(notification);
		expect(screen.getByRole("dialog", { name: "通知" })).not.toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "移除通知入口" }));
		expect(notification.isConnected).toBe(false);
		expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).not.toBe(
			notification.id,
		);
	});

	it("减弱动态退场期间 Anchor 仍 inert，完成后不抢走外部焦点", async () => {
		render(
			<div data-motion="reduce">
				<CompositeStatus />
				<button type="button">外部</button>
			</div>,
		);
		fireEvent.click(screen.getByRole("button", { name: "通知" }));
		const outside = screen.getByRole("button", { name: "外部" });
		act(() => outside.focus());
		expect(screen.getByTestId("composite-anchor").hasAttribute("inert")).toBe(true);
		await waitFor(() => expect(panel()).toBeNull());
		expect(screen.getByTestId("composite-anchor").hasAttribute("inert")).toBe(false);
		expect(document.activeElement).toBe(outside);
	});

	it("接力与收回打断均保持原 Anchor 隐藏，最终回到同一按钮", async () => {
		const waapi = stubWaapi();
		stubGeometry();
		render(<CompositeStatus />);
		const notification = screen.getByRole("button", { name: "通知" });
		fireEvent.click(notification);
		waapi.shape()[0].animation.finish();
		fireEvent.click(screen.getByRole("button", { name: "详情" }));
		expect(screen.getByRole("dialog", { name: "详情面板" })).not.toBeNull();
		fireEvent.keyDown(document, { key: "Escape" });
		stubMidFlight();
		fireEvent.click(screen.getByRole("dialog"));
		expect(waapi.shape().at(-1)?.keyframes[0].clipPath).toBe(MID_CLIP);
		expect(screen.getByTestId("composite-anchor").hasAttribute("inert")).toBe(true);
		fireEvent.keyDown(document, { key: "Escape" });
		const collapse = waapi.shape().at(-1) as Track;
		expect(collapse.keyframes.at(-1)?.clipPath).toBe("inset(0px 200px 200px 0px round 20px)");
		act(() => collapse.animation.finish());
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(notification);
	});
});
