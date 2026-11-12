export interface CodePreviewProps {
	url: string;
	/** 用于推断语言；显式 language 优先。 */
	name?: string;
	language?: string;
	className?: string;
}
