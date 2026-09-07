import { cn } from "@shared/lib/utils";
import { Signature } from "@shared/ui/signature";
import { useInView } from "motion/react";
import { useRef } from "react";

import styles from "./ArticleSignature.module.css";

interface ArticleSignatureProps {
	name: string;
}

const vectorSignatureNames = new Set(["xunrua", "violet", "alan turing", "turing"]);

/** 在文章进入视口时写下作者落款；无矢量笔迹的用户名以文字签名降级。 */
export function ArticleSignature({ name }: ArticleSignatureProps) {
	const rootRef = useRef<HTMLElement>(null);
	const isInView = useInView(rootRef, { once: true, margin: "0px 0px -12% 0px" });
	const normalizedName = name.trim().toLowerCase();
	const hasVectorSignature = vectorSignatureNames.has(normalizedName);

	return (
		<footer
			ref={rootRef}
			data-article-signature
			data-visible={isInView}
			className={styles.root}
		>
			<div className={styles.divider} aria-hidden="true">
				<span className={cn(styles.rule, isInView && styles.ruleVisible)} />
				<span className={styles.kicker}>FINIS</span>
			</div>
			<div className={styles.mark}>
				{hasVectorSignature ? (
					<Signature
						name={name}
						size="lg"
						variant="default"
						autoPlay={isInView}
						data-vector-signature
					/>
				) : (
					<span className={styles.textSignature}>{name}</span>
				)}
			</div>
			<p className={styles.byline}>
				<span>Written by</span>
				<strong>{name}</strong>
			</p>
		</footer>
	);
}
