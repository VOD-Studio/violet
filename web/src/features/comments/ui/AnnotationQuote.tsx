/** 批注浮层里引用的原文：正文引用的写法（衬线大引号），最多两行，由样式限高。 */
export function AnnotationQuote({ children }: { children: string }) {
	return (
		<blockquote className="annotation-quote">
			<span>{children}</span>
		</blockquote>
	);
}
