import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import { CodeBlock } from "@violet/ui";
import { type ComponentType, createContext, useContext } from "react";

/** 正文代码载体的渲染参数，执行能力由应用层注入。 */
export interface RunnableCodeProps {
	language: string;
	source: string;
	/** 运行参数覆盖项的 JSON 文本；省略时采用代码运行器的默认设置。 */
	overridesJson?: string;
	filename?: string;
	highlightedLines?: readonly number[];
}

/**
 * 应用层提供的可运行代码加载入口。
 *
 * @remarks 仅在近视口或重试时调用；须保持函数身份稳定，不预先创建会缓存失败的 React.lazy 实例。
 */
export type RunnableCodeLoader = () => Promise<{ default: ComponentType<RunnableCodeProps> }>;

/** 注入应用层加载入口；值为 null 时仅显示完整源码，不调用执行服务。 */
export const RunnableCodeLoaderContext = createContext<RunnableCodeLoader | null>(null);

/**
 * 以完整源码承载可运行块，在接近视口后装配应用层执行界面。
 *
 * @remarks SSR、未注入能力和加载失败均保留源码；失败重试由局部边界重新调用 loader。
 */
export function RunnableCodeRenderer(props: RunnableCodeProps) {
	const load = useContext(RunnableCodeLoaderContext);
	const fallback = (
		<CodeBlock
			code={props.source}
			language={props.language}
			filename={props.filename}
			highlightedLines={props.highlightedLines}
			className="my-6"
			data-runnable="true"
			data-lang={props.language}
			data-source={props.source}
		/>
	);
	return load ? (
		<DeferredContent
			load={load}
			componentProps={props}
			fallback={fallback}
			label="可运行代码"
		/>
	) : (
		fallback
	);
}
