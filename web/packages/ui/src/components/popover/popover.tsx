import { cn } from "cn";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
	type ComponentProps,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

interface PopoverContextValue {
	/** 触发器元素；用于命名面板、回收焦点与监测滚出视野。 */
	trigger: HTMLElement | null;
	setTrigger: (node: HTMLElement | null) => void;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(part: string): PopoverContextValue {
	const context = useContext(PopoverContext);
	if (!context) throw new Error(`${part} 必须放在 Popover 内`);
	return context;
}

/** Popover 根的属性：受控 `open`、`defaultOpen` 与 `onOpenChange`。 */
type PopoverProps = ComponentProps<typeof PopoverPrimitive.Root>;

/**
 * 与触发器相关的小面板：非模态，无遮罩，背后可滚动。
 * 触发器滚出视野时自动关闭（Radix 的 hideWhenDetached 只隐藏、不关闭）。
 */
function Popover({ open, defaultOpen = false, onOpenChange, ...props }: PopoverProps) {
	const [trigger, setTrigger] = useState<HTMLElement | null>(null);
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

	// 触发器被页面或任一滚动祖先带出视野时，IntersectionObserver 报告不再相交。
	useEffect(() => {
		if (!currentOpen || !trigger || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver((entries) => {
			const latest = entries.at(-1);
			if (latest && !latest.isIntersecting) handleOpenChange(false);
		});
		observer.observe(trigger);
		return () => observer.disconnect();
	}, [currentOpen, trigger, handleOpenChange]);

	const context = useMemo(() => ({ trigger, setTrigger }), [trigger]);

	return (
		<PopoverContext.Provider value={context}>
			<PopoverPrimitive.Root
				data-slot="popover"
				open={currentOpen}
				onOpenChange={handleOpenChange}
				{...props}
			/>
		</PopoverContext.Provider>
	);
}

/** 点击后打开或关闭面板；打开时带 `aria-expanded` 与 `data-state=open`，按钮据此呈现按下态。 */
function PopoverTrigger({ ref, id, ...props }: ComponentProps<typeof PopoverPrimitive.Trigger>) {
	const { setTrigger } = usePopoverContext("PopoverTrigger");
	const fallbackId = useId();

	const setRef = useCallback(
		(node: HTMLButtonElement | null) => {
			// 面板用触发器的名字作标签：触发器自己没有 id 时补一个，asChild 子元素的 id 优先。
			if (node && !node.id) node.id = fallbackId;
			setTrigger(node);
			if (typeof ref === "function") ref(node);
			else if (ref) ref.current = node;
		},
		[fallbackId, ref, setTrigger],
	);

	return <PopoverPrimitive.Trigger data-slot="popover-trigger" ref={setRef} id={id} {...props} />;
}

/** 面板属性：`container` 控制 Portal 挂载点，其余为 Radix Popover.Content 的属性。 */
interface PopoverContentProps extends ComponentProps<typeof PopoverPrimitive.Content> {
	/** 挂载 Portal 的容器；默认 `document.body`。 */
	container?: HTMLElement | null;
}

/** 面板：默认在触发器下方、起点对齐，放不下翻到对面，仍放不下则贴边平移。 */
function PopoverContent({
	ref,
	className,
	align = "start",
	sideOffset = 8,
	collisionPadding = 8,
	container,
	onCloseAutoFocus,
	...props
}: PopoverContentProps) {
	const { trigger } = usePopoverContext("PopoverContent");
	const contentRef = useRef<HTMLDivElement | null>(null);
	const setRef = useCallback(
		(node: HTMLDivElement | null) => {
			contentRef.current = node;
			if (typeof ref === "function") ref(node);
			else if (ref) ref.current = node;
		},
		[ref],
	);

	return (
		<PopoverPrimitive.Portal container={container}>
			<PopoverPrimitive.Content
				data-slot="popover-content"
				ref={setRef}
				align={align}
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				aria-labelledby={props["aria-label"] === undefined ? trigger?.id : undefined}
				onCloseAutoFocus={(event) => {
					onCloseAutoFocus?.(event);
					if (event.defaultPrevented) return;
					// Radix 在点击外部后让焦点留在点击处；点到空白处时仍应回到触发器，
					// 点到别的可聚焦元素（如另一个触发器）则尊重那次聚焦。
					event.preventDefault();
					const active = document.activeElement;
					if (
						!active ||
						active === document.body ||
						contentRef.current?.contains(active)
					) {
						trigger?.focus({ preventScroll: true });
					}
				}}
				{...props}
				className={cn("v-popover v-float", className)}
			/>
		</PopoverPrimitive.Portal>
	);
}

export { Popover, PopoverContent, type PopoverContentProps, type PopoverProps, PopoverTrigger };
