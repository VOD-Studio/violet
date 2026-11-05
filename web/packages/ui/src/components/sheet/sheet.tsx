import { cn } from "cn";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import {
	type ComponentProps,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	isInsideFloating,
	type Opener,
	OpenerCapture,
	restoreFocus,
	useStackedScrim,
	useTrackClicks,
} from "../../lib/modal-opener";
import { Button } from "../button";

/** 宽度档：小 360、中 400、大 520。 */
export type SheetSize = "sm" | "md" | "lg";

interface SheetContextValue {
	open: boolean;
	modal: boolean;
}

const SheetContext = createContext<SheetContextValue | null>(null);

function useSheetContext(part: string): SheetContextValue {
	const context = useContext(SheetContext);
	if (!context) throw new Error(`${part} 必须放在 Sheet 内`);
	return context;
}

/** Sheet 根的属性：受控 `open`、`defaultOpen`、`onOpenChange` 与 `modal`。 */
type SheetProps = ComponentProps<typeof SheetPrimitive.Root>;

/**
 * 从窗口一侧滑出的面板，承载筛选、详情与较长的设置。
 * 有遮罩（modal，默认）时先处理完面板；无遮罩时页面照常滚动和点击，适合一边看列表一边看详情。
 */
function Sheet({ open, defaultOpen = false, onOpenChange, modal = true, ...props }: SheetProps) {
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
	const context = useMemo(() => ({ open: currentOpen, modal }), [currentOpen, modal]);
	return (
		<SheetContext.Provider value={context}>
			<SheetPrimitive.Root
				data-slot="sheet"
				open={currentOpen}
				onOpenChange={handleOpenChange}
				modal={modal}
				{...props}
			/>
		</SheetContext.Provider>
	);
}

function SheetTrigger(props: ComponentProps<typeof SheetPrimitive.Trigger>) {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: ComponentProps<typeof SheetPrimitive.Close>) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

/** 面板属性：除 Radix Dialog.Content 的属性外，还有方向、宽度、遮罩与换内容的标识。 */
interface SheetContentProps extends ComponentProps<typeof SheetPrimitive.Content> {
	/** @default "right" */
	side?: "right" | "left";
	/**
	 * 宽度档；最宽不超过窗口宽度减 48，宽度变化有 280ms 过渡。
	 * @default "md"
	 */
	size?: SheetSize;
	/** @default true */
	showCloseButton?: boolean;
	/**
	 * 有遮罩时遮罩是否着色。
	 * @default true
	 */
	overlay?: boolean;
	/** 面板里显示的是哪一项；已打开时它变化，标题与内容交叉淡化，面板本身不动 */
	contentKey?: string | number;
	/** 挂载 Portal 的容器；默认 `document.body` */
	container?: HTMLElement | null;
}

const FOCUSABLE =
	"button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

/** 标题栏之后的第一个控件；没有时为面板本身。 */
function initialFocus(content: HTMLElement): HTMLElement {
	const candidates = Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE));
	return candidates.find((element) => !element.classList.contains("v-sheet__close")) ?? content;
}

/**
 * 侧边面板：离窗口上、下与侧边各 12，内容区单独滚动。
 * 打开时焦点落到标题栏后的第一个控件，关闭后回到打开它的按钮或行；无遮罩时 F6 在面板与页面之间跳转。
 */
function SheetContent({
	ref,
	className,
	children,
	side = "right",
	size = "md",
	showCloseButton = true,
	overlay = true,
	contentKey,
	container,
	onOpenAutoFocus,
	onCloseAutoFocus,
	onInteractOutside,
	onPointerDownOutside,
	...props
}: SheetContentProps) {
	const { open, modal } = useSheetContext("SheetContent");
	const stacked = useStackedScrim(open && modal);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const openerRef = useRef<Opener>({ clicked: null, focus: null });
	const [swaps, setSwaps] = useState(0);
	const keyRef = useRef(contentKey);

	const captureOpener = useCallback((opener: Opener) => {
		openerRef.current = opener;
	}, []);

	const setRef = useCallback(
		(node: HTMLDivElement | null) => {
			contentRef.current = node;
			if (typeof ref === "function") ref(node);
			else if (ref) ref.current = node;
		},
		[ref],
	);

	// 换内容不重播滑入：只让标题与内容重新淡入一次
	useLayoutEffect(() => {
		if (keyRef.current === contentKey) return;
		keyRef.current = contentKey;
		if (open) setSwaps((count) => count + 1);
	}, [contentKey, open]);

	// 无遮罩时 F6 在面板与页面之间跳转
	useEffect(() => {
		if (!open || modal) return;
		const onKeyDown = (event: KeyboardEvent) => {
			const content = contentRef.current;
			if (event.key !== "F6" || !content) return;
			event.preventDefault();
			if (content.contains(document.activeElement)) restoreFocus(openerRef.current.focus);
			else initialFocus(content).focus({ preventScroll: true });
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, modal]);

	return (
		<>
			{open && <OpenerCapture onCapture={captureOpener} />}
			<SheetPrimitive.Portal container={container}>
				<SheetPrimitive.Overlay
					data-slot="sheet-overlay"
					data-stacked={stacked || undefined}
					className={cn("v-scrim v-scrim--soft", !overlay && "v-scrim--clear")}
				/>
				<SheetPrimitive.Content
					data-slot="sheet-content"
					data-side={side}
					data-swap={swaps === 0 ? undefined : swaps % 2 ? "odd" : "even"}
					aria-modal={modal}
					ref={setRef}
					onOpenAutoFocus={(event) => {
						onOpenAutoFocus?.(event);
						if (event.defaultPrevented || !contentRef.current) return;
						event.preventDefault();
						initialFocus(contentRef.current).focus({ preventScroll: true });
					}}
					onCloseAutoFocus={(event) => {
						onCloseAutoFocus?.(event);
						if (event.defaultPrevented) return;
						event.preventDefault();
						restoreFocus(openerRef.current.focus);
					}}
					onPointerDownOutside={(event) => {
						if (isInsideFloating(event.target)) event.preventDefault();
						onPointerDownOutside?.(event);
					}}
					onInteractOutside={(event) => {
						// 无遮罩时页面照常可用，点页面、聚焦页面都不关闭
						if (!modal || isInsideFloating(event.target)) event.preventDefault();
						onInteractOutside?.(event);
					}}
					{...props}
					className={cn("v-sheet", `v-sheet--${size}`, className)}
				>
					{showCloseButton && (
						<SheetPrimitive.Close asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								className="v-sheet__close"
								aria-label="关闭"
							>
								<XIcon aria-hidden="true" />
							</Button>
						</SheetPrimitive.Close>
					)}
					{children}
				</SheetPrimitive.Content>
			</SheetPrimitive.Portal>
		</>
	);
}

/** 标题栏：高 56，标题过长时截断。 */
function SheetHeader({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="sheet-header" className={cn("v-sheet__header", className)} {...props} />;
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			className={cn("v-sheet__title", className)}
			{...props}
		/>
	);
}

function SheetDescription({
	className,
	...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
	return (
		<SheetPrimitive.Description
			data-slot="sheet-description"
			className={cn("v-sheet__description", className)}
			{...props}
		/>
	);
}

/** 内容区：单独滚动，滚到头不带动背后的页面。 */
function SheetBody({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="sheet-body" className={cn("v-sheet__body", className)} {...props} />;
}

/** 底栏：可选，顶上一条细线，按钮等分或靠右。 */
function SheetFooter({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="sheet-footer" className={cn("v-sheet__footer", className)} {...props} />;
}

export {
	Sheet,
	SheetBody,
	SheetClose,
	SheetContent,
	type SheetContentProps,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	type SheetProps,
	SheetTitle,
	SheetTrigger,
};
