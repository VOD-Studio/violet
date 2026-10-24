import { useViewportPreparation } from "@shared/hooks/use-viewport-preparation";
import { retryPreloadStylesheet } from "@shared/lib/retry-preload-stylesheet";
import {
	Component,
	type ComponentType,
	lazy,
	type ReactNode,
	Suspense,
	useMemo,
	useState,
} from "react";

interface LoadBoundaryProps {
	children: ReactNode;
	fallback: ReactNode;
	label: string;
	onRetry: (error: unknown) => void;
	inline: boolean;
}

/** 局部增强的失败反馈与恢复操作，不持有所属正文状态。 */
export interface EnhancementFailureProps {
	/** 原始异常，仅用于选择恢复方式，不直接输出到页面。 */
	error: unknown;
	/** 面向读者的失败说明。 */
	message: string;
	/** 在当前文档内重新尝试；模块下载失败时改为重新载入文档。 */
	onRetry: () => void;
	/**
	 * 局部重试的按钮文案。
	 *
	 * @default "重试"
	 */
	retryLabel?: string;
	/**
	 * 使用行内反馈，避免破坏所属段落结构。
	 *
	 * @default false
	 */
	inline?: boolean;
}

const MODULE_FETCH_ERROR =
	/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

/**
 * 保留所属正文，并为失败的增强提供可执行的恢复操作。
 *
 * @remarks 浏览器会缓存模块下载失败，同地址 import 不能在原文档内恢复，须显式重新载入页面。
 * CSS 预加载失败与渲染错误仍交给 onRetry 局部恢复。
 */
export function EnhancementFailure({
	error,
	message,
	onRetry,
	retryLabel = "重试",
	inline = false,
}: EnhancementFailureProps) {
	const Feedback = inline ? "span" : "div";
	const reload = error instanceof TypeError && MODULE_FETCH_ERROR.test(error.message);
	return (
		<Feedback
			role="alert"
			className={`${inline ? "inline-flex" : "flex"} my-3 flex-wrap items-center gap-3 text-sm text-muted-foreground`}
		>
			<span>{message}</span>
			<button
				type="button"
				onClick={reload ? () => window.location.reload() : onRetry}
				className="rounded-md px-2 py-1 text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				{reload ? "重新载入页面" : retryLabel}
			</button>
		</Feedback>
	);
}

class LoadBoundary extends Component<LoadBoundaryProps, { failed: boolean; error: unknown }> {
	state: { failed: boolean; error: unknown } = { failed: false, error: null };

	static getDerivedStateFromError(error: unknown) {
		return { failed: true, error };
	}

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<>
				{this.props.fallback}
				<EnhancementFailure
					error={this.state.error}
					message={`${this.props.label}加载失败，其他内容仍可阅读。`}
					inline={this.props.inline}
					onRetry={() => this.props.onRetry(this.state.error)}
				/>
			</>
		);
	}
}

/**
 * 异步增强的模块契约，降级内容必须独立于待加载模块。
 *
 * @typeParam P - 待加载组件的完整属性，调用方不能省略其必填字段。
 */
export interface AsyncContentProps<P extends object> {
	/** 保持函数引用稳定；重试会重新调用，不复用已拒绝的 React lazy 实例。 */
	load: () => Promise<{ default: ComponentType<P> }>;
	componentProps: P;
	/** SSR、准备期间和失败后均可阅读的内容，不依赖增强模块的下载。 */
	fallback: ReactNode;
	/** 局部错误提示中的内容名称。 */
	label: string;
	/**
	 * 错误反馈使用行内元素，适用于段落内公式；不会建立视口观察器。
	 *
	 * @default false
	 */
	inline?: boolean;
}

/** 按视口准备的块级增强；基础模块与降级内容遵守 AsyncContentProps 契约。 */
export interface DeferredContentProps<P extends object>
	extends Omit<AsyncContentProps<P>, "inline"> {
	/**
	 * 是否等待接近视口；交互已触发或必须保留 SSR 语义内容时传 `false`。
	 *
	 * @default true
	 */
	defer?: boolean;
}

/**
 * 加载增强模块，将失败限制在所属内容，并在重试时恢复模块与失败的异步样式。
 *
 * @typeParam P - 待加载组件的完整属性。
 * @remarks 不添加宿主元素或视口观察器；行内公式可直接用于段落内。
 * 重试只重建失败模块，不重新挂载外部正文和已完成的其他增强。
 */
export function AsyncContent<P extends object>({
	load,
	componentProps,
	fallback,
	label,
	inline = false,
}: AsyncContentProps<P>) {
	const [attempt, setAttempt] = useState<{ count: number; error: unknown }>({
		count: 0,
		error: null,
	});
	const LazyContent = useMemo(
		() =>
			lazy(async () => {
				if (attempt.count > 0) await retryPreloadStylesheet(attempt.error);
				return load();
			}),
		[load, attempt],
	);
	return (
		<LoadBoundary
			key={attempt.count}
			fallback={fallback}
			label={label}
			inline={inline}
			onRetry={(error) => setAttempt((previous) => ({ count: previous.count + 1, error }))}
		>
			<Suspense fallback={fallback}>
				<LazyContent {...componentProps} />
			</Suspense>
		</LoadBoundary>
	);
}

/**
 * 在接近视口时加载文章增强模块，SSR 与首次客户端渲染保持可读降级内容。
 *
 * @typeParam P - 待加载组件的完整属性。
 * @remarks 激活后不因滚出视口卸载；跨文章身份变化时，调用方须重建所属正文树。
 */
export function DeferredContent<P extends object>({
	defer = true,
	...props
}: DeferredContentProps<P>) {
	const { ref, ready } = useViewportPreparation<HTMLDivElement>();
	return (
		<div
			ref={ref}
			className="min-w-0"
			data-content-preparation={ready || !defer ? "ready" : "waiting"}
		>
			{ready || !defer ? <AsyncContent {...props} /> : props.fallback}
		</div>
	);
}
