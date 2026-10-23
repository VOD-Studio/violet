import { type ComponentType, createContext, useContext } from "react";

/** 正文代码载体的渲染参数，执行能力由应用层注入。 */
export interface RunnableCodeProps {
	language: string;
	source: string;
	overridesJson?: string;
}

export const RunnableCodeContext = createContext<ComponentType<RunnableCodeProps> | null>(null);

/** 未注入执行能力时保留完整源码，不发起业务请求。 */
export function RunnableCodeRenderer(props: RunnableCodeProps) {
	const Renderer = useContext(RunnableCodeContext);
	return Renderer ? (
		<Renderer {...props} />
	) : (
		<pre data-runnable="true" data-lang={props.language} data-source={props.source}>
			<code>{props.source}</code>
		</pre>
	);
}
