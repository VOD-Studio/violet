import { cn } from "@shared/lib/utils";
import { parseXPostUrl, type XPostReference } from "@shared/ui/article-embeds/x-post-url";
import { Children, isValidElement, lazy, type ReactElement, type ReactNode, Suspense } from "react";
import type { Components } from "react-markdown";
import styles from "./RichParagraph.module.css";

const LazyXPostEmbed = lazy(() =>
	import("../../article-embeds/XPostEmbed").then((module) => ({
		default: module.XPostEmbed,
	})),
);

function nodeToText(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(nodeToText).join("");
	if (isValidElement<{ children?: ReactNode }>(node)) return nodeToText(node.props.children);
	return "";
}

function standaloneXPost(children: ReactNode): XPostReference | null {
	const nodes = Children.toArray(children).filter(
		(node) => typeof node !== "string" || node.trim().length > 0,
	);
	if (nodes.length !== 1 || !isValidElement(nodes[0])) return null;

	const link = nodes[0] as ReactElement<{ children?: ReactNode; href?: unknown }>;
	if (typeof link.props.href !== "string") return null;

	const label = nodeToText(link.props.children).trim();
	try {
		if (new URL(label).href !== new URL(link.props.href).href) return null;
	} catch {
		return null;
	}

	return parseXPostUrl(link.props.href);
}

/** 将单独成段的 X/Twitter 动态链接升级为卡片，其余段落保持原渲染。 */
export function createRichParagraphRenderer(): NonNullable<Components["p"]> {
	return ({ children, style, className }) => {
		const post = standaloneXPost(children);
		if (post) {
			return (
				<Suspense
					fallback={
						<p className={styles.chunkFallback}>
							<a
								className={styles.chunkFallbackLink}
								href={post.href}
								target="_blank"
								rel="noopener noreferrer"
							>
								{post.href}
							</a>
						</p>
					}
				>
					<LazyXPostEmbed id={post.id} href={post.href} />
				</Suspense>
			);
		}

		return (
			<p style={style} className={cn(styles.paragraph, className)}>
				{children}
			</p>
		);
	};
}
