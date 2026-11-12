import { cn } from "cn";
import { Dialog as DrawerPrimitive } from "radix-ui";
import {
	type ComponentProps,
	createContext,
	type PointerEvent,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type Opener,
	OpenerCapture,
	restoreFocus,
	useStackedScrim,
	useTrackClicks,
} from "../../lib/modal-opener";
import { type DrawerDetent, type DrawerSnapPoints, useDrawerDrag } from "./use-drawer-drag";

interface DrawerContextValue {
	open: boolean;
	modal: boolean;
	close: () => void;
}

interface DrawerDragContextValue {
	/** 绑在把手与标题区的拖动起点 */
	onHandlePointerDown: (event: PointerEvent) => void;
	/** 绑在内容区的拖动起点 */
	onBodyPointerDown: (event: PointerEvent) => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);
const DrawerDragContext = createContext<DrawerDragContextValue | null>(null);

function useDrawerContext(part: string): DrawerContextValue {
	const context = useContext(DrawerContext);
	if (!context) throw new Error(`${part} 必须放在 Drawer 内`);
	return context;
}

function useDrawerDragContext(part: string): DrawerDragContextValue {
	const context = useContext(DrawerDragContext);
	if (!context) throw new Error(`${part} 必须放在 DrawerContent 内`);
	return context;
}

/** Drawer 根的属性：受控 `open`、`defaultOpen`、`onOpenChange` 与 `modal`（默认模态，背后一直锁住）。 */
type DrawerProps = ComponentProps<typeof DrawerPrimitive.Root>;

/**
 * 手机上从屏幕底边升起的面板，可以按住往下拖关闭。
 * 只在窄于 640 时使用；同样的内容在桌面换成弹出层、侧边面板或对话框，由调用处按断点切换。
 */
function Drawer({ open, defaultOpen = false, onOpenChange, modal = true, ...props }: DrawerProps) {
	useTrackClicks();
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	const isControlled = open !== undefined;
	const currentOpen = isControlled ? open : uncontrolledOpen;
	const handleOpenChange = useCallback(
		(next: boolean) => {
			if (!isControlled) setUncontrolledOpen(next);
			onOpenChange?.(next);
		},
		[isControlled, onOpenChange],
	);
	const context = useMemo<DrawerContextValue>(
		() => ({ open: currentOpen, modal, close: () => handleOpenChange(false) }),
		[currentOpen, modal, handleOpenChange],
	);
	return (
		<DrawerContext.Provider value={context}>
			<DrawerPrimitive.Root
				data-slot="drawer"
				open={currentOpen}
				onOpenChange={handleOpenChange}
				modal={modal}
				{...props}
			/>
		</DrawerContext.Provider>
	);
}

function DrawerTrigger(props: ComponentProps<typeof DrawerPrimitive.Trigger>) {
	return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose(props: ComponentProps<typeof DrawerPrimitive.Close>) {
	return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

/** 抽屉面板的属性：除 Radix Dialog.Content 的属性外，还有高度档与挂载容器。 */
interface DrawerContentProps extends ComponentProps<typeof DrawerPrimitive.Content> {
	/**
	 * 高度档：随内容（分享、操作列表、短表单），或半屏 52% 与全屏两档（筛选这类较长的内容）。
	 * @default "content"
	 */
	snapPoints?: DrawerSnapPoints;
	/** 挂载 Portal 的容器；默认 `document.body` */
	container?: HTMLElement | null;
}

const FIELD = "input:not([type='hidden']):not(:disabled), textarea:not(:disabled)";

/**
 * 抽屉面板：左右与底边贴住屏幕，只有上面两个角是圆角；内容区只在全屏档滚动。
 * 拖过可见高度的 25% 或快速下滑就关闭，不够就弹回；两档时先停在半屏。
 */
function DrawerContent({
	ref,
	className,
	children,
	snapPoints = "content",
	container,
	onOpenAutoFocus,
	onCloseAutoFocus,
	...props
}: DrawerContentProps) {
	const { open, modal, close } = useDrawerContext("DrawerContent");
	const stacked = useStackedScrim(open && modal);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const [panel, setPanel] = useState<HTMLDivElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	const openerRef = useRef<Opener>({ clicked: null, focus: null });
	const [detent, setDetent] = useState<DrawerDetent>(
		snapPoints === "half-full" ? "half" : "full",
	);
	const { onHandlePointerDown, onBodyPointerDown } = useDrawerDrag({
		panel,
		overlayRef,
		snapPoints,
		detent,
		onDetentChange: setDetent,
		onClose: close,
	});

	const drag = useMemo(
		() => ({ onHandlePointerDown, onBodyPointerDown }),
		[onHandlePointerDown, onBodyPointerDown],
	);

	// 每次打开都从第一档开始
	useEffect(() => {
		if (open) setDetent(snapPoints === "half-full" ? "half" : "full");
	}, [open, snapPoints]);

	// 跟着键盘：可视区被软键盘顶起时，面板一起抬高
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!open || !viewport) return;
		const update = () => {
			const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
			panelRef.current?.style.setProperty("--v-drawer-keyboard", `${covered}px`);
		};
		update();
		viewport.addEventListener("resize", update);
		viewport.addEventListener("scroll", update);
		return () => {
			viewport.removeEventListener("resize", update);
			viewport.removeEventListener("scroll", update);
		};
	}, [open]);

	const captureOpener = useCallback((opener: Opener) => {
		openerRef.current = opener;
	}, []);

	const setRef = useCallback(
		(node: HTMLDivElement | null) => {
			panelRef.current = node;
			setPanel(node);
			if (typeof ref === "function") ref(node);
			else if (ref) ref.current = node;
		},
		[ref],
	);

	return (
		<>
			{open && <OpenerCapture onCapture={captureOpener} />}
			<DrawerPrimitive.Portal container={container}>
				<DrawerPrimitive.Overlay
					ref={overlayRef}
					data-slot="drawer-overlay"
					data-stacked={stacked || undefined}
					className="v-scrim v-drawer-overlay"
				/>
				<DrawerPrimitive.Content
					data-slot="drawer-content"
					data-detent={detent}
					aria-modal={modal}
					ref={setRef}
					onOpenAutoFocus={(event) => {
						onOpenAutoFocus?.(event);
						const panel = panelRef.current;
						if (event.defaultPrevented || !panel) return;
						// 焦点进标题；有输入框时进输入框
						const target =
							panel.querySelector<HTMLElement>(FIELD) ??
							panel.querySelector<HTMLElement>("[data-slot='drawer-title']");
						if (!target) return;
						event.preventDefault();
						target.focus({ preventScroll: true });
					}}
					onCloseAutoFocus={(event) => {
						onCloseAutoFocus?.(event);
						if (event.defaultPrevented) return;
						event.preventDefault();
						restoreFocus(openerRef.current.focus);
					}}
					{...props}
					className={cn("v-drawer", `v-drawer--${snapPoints}`, className)}
				>
					<div
						aria-hidden="true"
						data-slot="drawer-handle"
						className="v-drawer__handle"
						onPointerDown={onHandlePointerDown}
					/>
					<DrawerDragContext.Provider value={drag}>{children}</DrawerDragContext.Provider>
				</DrawerPrimitive.Content>
			</DrawerPrimitive.Portal>
		</>
	);
}

/** 标题区：整块都能按住拖；右侧可以放一个文字按钮（重置）。 */
function DrawerHeader({ className, onPointerDown, ...props }: ComponentProps<"div">) {
	const { onHandlePointerDown } = useDrawerDragContext("DrawerHeader");
	return (
		<div
			data-slot="drawer-header"
			className={cn("v-drawer__header", className)}
			onPointerDown={(event) => {
				onPointerDown?.(event);
				if (!event.defaultPrevented) onHandlePointerDown(event);
			}}
			{...props}
		/>
	);
}

function DrawerTitle({ className, ...props }: ComponentProps<typeof DrawerPrimitive.Title>) {
	return (
		<DrawerPrimitive.Title
			data-slot="drawer-title"
			tabIndex={-1}
			className={cn("v-drawer__title", className)}
			{...props}
		/>
	);
}

function DrawerDescription({
	className,
	...props
}: ComponentProps<typeof DrawerPrimitive.Description>) {
	return (
		<DrawerPrimitive.Description
			data-slot="drawer-description"
			className={cn("v-drawer__description", className)}
			{...props}
		/>
	);
}

/** 内容区：只有全屏档滚动；滚到顶再往下拖时带动面板。 */
function DrawerBody({ className, onPointerDown, ...props }: ComponentProps<"div">) {
	const { onBodyPointerDown } = useDrawerDragContext("DrawerBody");
	return (
		<div
			data-slot="drawer-body"
			className={cn("v-drawer__body", className)}
			onPointerDown={(event) => {
				onPointerDown?.(event);
				if (!event.defaultPrevented) onBodyPointerDown(event);
			}}
			{...props}
		/>
	);
}

/** 底栏：主按钮 44 铺满，底部留出系统手势区。 */
function DrawerFooter({ className, ...props }: ComponentProps<"div">) {
	return (
		<div data-slot="drawer-footer" className={cn("v-drawer__footer", className)} {...props} />
	);
}

export type { DrawerDetent, DrawerSnapPoints };
export {
	Drawer,
	DrawerBody,
	DrawerClose,
	DrawerContent,
	type DrawerContentProps,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	type DrawerProps,
	DrawerTitle,
	DrawerTrigger,
};
