import { cn } from "cn";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
	type ComponentProps,
	createContext,
	Fragment,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useId,
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
import { hideOrigin, morph, morphOrigin, returnOrigin } from "./morph";

/** 宽度档：小 448、中 512、大 672、超大 896。 */
export type DialogSize = "sm" | "md" | "lg" | "xl";

/** 进场方式：从打开它的按钮展开，或在原位落下。 */
export type DialogEntrance = "expand" | "settle";

interface DialogContextValue {
	open: boolean;
	modal: boolean;
	/** DialogTrigger 的元素；受控打开时为空，由打开瞬间的焦点推断打开者 */
	trigger: HTMLElement | null;
	setTrigger: (node: HTMLElement | null) => void;
	/** DialogContent 写入：有未保存的修改时拦下关闭请求 */
	dirtyRef: RefObject<boolean>;
	/** 底栏正在询问要不要放弃修改 */
	guarding: boolean;
	keepEditing: () => void;
	discard: () => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(part: string): DialogContextValue {
	const context = useContext(DialogContext);
	if (!context) throw new Error(`${part} 必须放在 Dialog 内`);
	return context;
}

/** Dialog 根的属性：受控 `open`、`defaultOpen`、`onOpenChange` 与 `modal`。 */
type DialogProps = ComponentProps<typeof DialogPrimitive.Root>;

/**
 * 压暗页面、专心做完一件小事的模态框。
 * Esc、点遮罩、关闭按钮与取消等价；内容有未保存的修改时，这四种请求先在底栏询问一次。
 */
function Dialog({ open, defaultOpen = false, onOpenChange, modal = true, ...props }: DialogProps) {
	useTrackClicks();
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	const isControlled = open !== undefined;
	const currentOpen = isControlled ? open : uncontrolledOpen;
	const [trigger, setTrigger] = useState<HTMLElement | null>(null);
	const [guarding, setGuarding] = useState(false);
	const dirtyRef = useRef(false);
	const returnFocusRef = useRef<HTMLElement | null>(null);

	const commit = useCallback(
		(next: boolean) => {
			if (!isControlled) setUncontrolledOpen(next);
			onOpenChange?.(next);
		},
		[isControlled, onOpenChange],
	);

	const handleOpenChange = useCallback(
		(next: boolean) => {
			// 询问已经出现时再请求一次关闭，就当作放弃
			if (!next && dirtyRef.current && !guarding) {
				const active = document.activeElement;
				returnFocusRef.current = active instanceof HTMLElement ? active : null;
				setGuarding(true);
				return;
			}
			setGuarding(false);
			commit(next);
		},
		[commit, guarding],
	);

	useEffect(() => {
		if (!currentOpen) setGuarding(false);
	}, [currentOpen]);

	const context = useMemo<DialogContextValue>(
		() => ({
			open: currentOpen,
			modal,
			trigger,
			setTrigger,
			dirtyRef,
			guarding,
			keepEditing: () => {
				setGuarding(false);
				restoreFocus(returnFocusRef.current);
			},
			discard: () => {
				setGuarding(false);
				commit(false);
			},
		}),
		[currentOpen, modal, trigger, guarding, commit],
	);

	return (
		<DialogContext.Provider value={context}>
			<DialogPrimitive.Root
				data-slot="dialog"
				open={currentOpen}
				onOpenChange={handleOpenChange}
				modal={modal}
				{...props}
			/>
		</DialogContext.Provider>
	);
}

/** 点击后打开对话框；对话框从它展开，关闭后焦点回到它。 */
function DialogTrigger({ ref, ...props }: ComponentProps<typeof DialogPrimitive.Trigger>) {
	const { setTrigger } = useDialogContext("DialogTrigger");
	const setRef = useCallback(
		(node: HTMLButtonElement | null) => {
			setTrigger(node);
			if (typeof ref === "function") ref(node);
			else if (ref) ref.current = node;
		},
		[ref, setTrigger],
	);
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" ref={setRef} {...props} />;
}

/** 关闭对话框的按钮；有未保存的修改时同样先询问。 */
function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/** 对话框外壳的属性：除 Radix Dialog.Content 的属性外，还有尺寸、遮罩、进场与未保存状态。 */
interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
	/**
	 * 宽度档；窄于 640 时一律为屏宽减 32。
	 * @default "md"
	 */
	size?: DialogSize;
	/**
	 * 右上角的关闭按钮；隐藏时底栏必须有「取消」。
	 * @default true
	 */
	showCloseButton?: boolean;
	/**
	 * 遮罩是否着色；不着色时点对话框外面仍等于取消。
	 * @default true
	 */
	overlay?: boolean;
	/** 进场方式；省略时从点击打开它的按钮展开，没有按钮（快捷键、系统提醒）时落位 */
	entrance?: DialogEntrance;
	/** 有未保存的修改：Esc、点遮罩、关闭按钮与取消先在底栏询问，不直接关掉 */
	dirty?: boolean;
	/** 挂载 Portal 的容器；默认 `document.body` */
	container?: HTMLElement | null;
	/** 遮罩的类名 */
	overlayClassName?: string;
	/** 去掉外壳的描边、底色与内边距，内容自管布局（图片预览） */
	bare?: boolean;
}

/** 内容区里第一个可填的字段；没有时为底栏最右的主按钮。 */
function initialFocus(content: HTMLElement): HTMLElement | null {
	const field = content.querySelector<HTMLElement>(
		"input:not([type='hidden']):not(:disabled), textarea:not(:disabled), select:not(:disabled), [contenteditable='true']",
	);
	if (field) return field;
	const actions = content.querySelectorAll<HTMLElement>(
		"[data-slot='dialog-footer'] button:not(:disabled)",
	);
	return actions.item(actions.length - 1);
}

/**
 * 对话框外壳：标题区和底栏固定，只有内容区滚动；最高为窗口高度减 64。
 * 打开时焦点落到第一个输入框，没有时落到主按钮；关闭后焦点回到打开它的按钮。
 */
function DialogContent({
	ref,
	className,
	children,
	size = "md",
	showCloseButton = true,
	overlay = true,
	entrance,
	dirty = false,
	container,
	overlayClassName,
	bare = false,
	onOpenAutoFocus,
	onCloseAutoFocus,
	onPointerDownOutside,
	onInteractOutside,
	...props
}: DialogContentProps) {
	const { open, modal, trigger, dirtyRef } = useDialogContext("DialogContent");
	const stacked = useStackedScrim(open && modal);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const openerRef = useRef<Opener>({ clicked: null, focus: null });
	const originRef = useRef<HTMLElement | null>(null);
	const latest = useRef({ ref, entrance, trigger, bare });
	latest.current = { ref, entrance, trigger, bare };

	useLayoutEffect(() => {
		dirtyRef.current = dirty;
	}, [dirty, dirtyRef]);

	const captureOpener = useCallback((opener: Opener) => {
		openerRef.current = opener;
	}, []);

	// 挂载即决定进场方式：在首帧绘制前开始动画，按钮与对话框之间没有闪烁。
	const setContentRef = useCallback((node: HTMLDivElement | null) => {
		contentRef.current = node;
		const {
			ref: forwarded,
			entrance: requested,
			trigger: triggerNode,
			bare: isBare,
		} = latest.current;
		if (typeof forwarded === "function") forwarded(node);
		else if (forwarded) forwarded.current = node;
		if (!node) return;
		const origin =
			isBare || requested === "settle"
				? null
				: morphOrigin(triggerNode ?? openerRef.current.clicked);
		const animation = origin ? morph(node, origin, false) : null;
		if (!isBare) node.dataset.entrance = animation ? "expand" : "settle";
		originRef.current = animation ? origin : null;
		if (origin && animation) hideOrigin(origin);
	}, []);

	// 收回：CSS 只放一段占位动画让 Radix 等它结束再卸载，外形的位移与裁切由脚本播放。
	useLayoutEffect(() => {
		const node = contentRef.current;
		const origin = originRef.current;
		if (open || !node || !origin) return;
		const animation = morph(node, origin, true);
		const done = () => returnOrigin(origin);
		if (animation) animation.finished.then(done, done);
		else done();
		originRef.current = null;
	}, [open]);

	useEffect(
		() => () => {
			if (originRef.current) returnOrigin(originRef.current);
		},
		[],
	);

	return (
		<>
			{open && <OpenerCapture onCapture={captureOpener} />}
			<DialogPrimitive.Portal container={container}>
				<DialogPrimitive.Overlay
					data-slot="dialog-overlay"
					data-stacked={stacked || undefined}
					className={cn(
						"v-scrim v-dialog-overlay",
						!overlay && "v-scrim--clear",
						overlayClassName,
					)}
				/>
				<DialogPrimitive.Content
					data-slot="dialog-content"
					ref={setContentRef}
					onOpenAutoFocus={(event) => {
						onOpenAutoFocus?.(event);
						if (event.defaultPrevented || !contentRef.current) return;
						const target = initialFocus(contentRef.current);
						if (!target) return;
						event.preventDefault();
						target.focus({ preventScroll: true });
					}}
					onCloseAutoFocus={(event) => {
						onCloseAutoFocus?.(event);
						if (event.defaultPrevented) return;
						event.preventDefault();
						restoreFocus(trigger ?? openerRef.current.focus);
					}}
					onPointerDownOutside={(event) => {
						if (isInsideFloating(event.target)) event.preventDefault();
						onPointerDownOutside?.(event);
					}}
					onInteractOutside={(event) => {
						if (isInsideFloating(event.target)) event.preventDefault();
						onInteractOutside?.(event);
					}}
					{...props}
					className={cn(
						"v-dialog",
						bare ? "v-dialog--bare" : `v-dialog--${size}`,
						className,
					)}
				>
					{showCloseButton && (
						<DialogPrimitive.Close asChild>
							<Button
								variant="ghost"
								iconOnly
								size="sm"
								className="v-dialog__close"
								aria-label="关闭"
							>
								<XIcon aria-hidden="true" />
							</Button>
						</DialogPrimitive.Close>
					)}
					{children}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</>
	);
}

/** 标题区：标题写这一步要做的事，说明可选、不重复标题。 */
function DialogHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div data-slot="dialog-header" className={cn("v-dialog__header", className)} {...props} />
	);
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn("v-dialog__title", className)}
			{...props}
		/>
	);
}

function DialogDescription({
	className,
	...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn("v-dialog__description", className)}
			{...props}
		/>
	);
}

/** 记录内容区是否离开顶部、下面是否还有内容；标题栏与底栏据此各出现一条细线。 */
function useScrollEdges(ref: RefObject<HTMLElement | null>) {
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		const update = () => {
			const top = node.scrollTop > 2;
			const more = node.scrollTop + node.clientHeight < node.scrollHeight - 2;
			if (top) node.dataset.scrollTop = "";
			else delete node.dataset.scrollTop;
			if (more) node.dataset.scrollMore = "";
			else delete node.dataset.scrollMore;
		};
		update();
		node.addEventListener("scroll", update, { passive: true });
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
		observer?.observe(node);
		for (const child of node.children) observer?.observe(child);
		return () => {
			node.removeEventListener("scroll", update);
			observer?.disconnect();
		};
	}, [ref]);
}

/** 内容区：对话框里唯一会滚动的部分，滚到头不带动背后的页面。 */
function DialogBody({ ref, className, ...props }: ComponentProps<"div">) {
	const bodyRef = useRef<HTMLDivElement | null>(null);
	useScrollEdges(bodyRef);
	const setRef = useCallback(
		(node: HTMLDivElement | null) => {
			bodyRef.current = node;
			if (typeof ref === "function") ref(node);
			else if (ref) ref.current = node;
		},
		[ref],
	);
	return (
		<div
			data-slot="dialog-body"
			ref={setRef}
			className={cn("v-dialog__body", className)}
			{...props}
		/>
	);
}

/** 底栏：按钮右对齐、主按钮在最右；有未保存的修改时换成「要放弃吗」的询问。 */
function DialogFooter({ className, children, ...props }: ComponentProps<"div">) {
	const { guarding, keepEditing, discard } = useDialogContext("DialogFooter");
	const statusId = useId();
	const keepRef = useRef<HTMLButtonElement>(null);

	// 询问出现时焦点留在不会丢失修改的一边
	useEffect(() => {
		if (guarding) keepRef.current?.focus();
	}, [guarding]);

	return (
		<div data-slot="dialog-footer" className={cn("v-dialog__footer", className)} {...props}>
			{guarding ? (
				<Fragment key="guard">
					<span id={statusId} role="status" className="v-dialog__guard">
						有未保存的修改，要放弃吗？
					</span>
					<Button
						ref={keepRef}
						variant="secondary"
						aria-describedby={statusId}
						onClick={keepEditing}
					>
						继续编辑
					</Button>
					<Button variant="secondary" className="v-dialog__discard" onClick={discard}>
						放弃修改
					</Button>
				</Fragment>
			) : (
				<Fragment key="actions">{children}</Fragment>
			)}
		</div>
	);
}

export {
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
};
