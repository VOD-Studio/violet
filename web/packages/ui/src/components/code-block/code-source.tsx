import { Fragment, useEffect, useRef, useState } from "react";
import type { HighlightToken } from "./highlight-types";

interface CodeSourceProps {
	code: string;
	language: string;
	highlightedLines?: readonly number[];
}

export function CodeSource({ code, language, highlightedLines = [] }: CodeSourceProps) {
	const [result, setResult] = useState<{
		code: string;
		language: string;
		lines: HighlightToken[][];
	}>();
	const root = useRef<HTMLPreElement>(null);
	useEffect(() => {
		const controller = new AbortController();
		const start = () => {
			void import("./highlighter")
				.then(({ highlightCode }) => highlightCode(code, language, controller.signal))
				.then((lines) => {
					if (!controller.signal.aborted) setResult({ code, language, lines });
				})
				.catch(() => {
					/* Keep the current raw source if enhancement fails. */
				});
		};
		let observer: IntersectionObserver | undefined;
		if (typeof IntersectionObserver === "undefined") start();
		else {
			observer = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					observer?.disconnect();
					start();
				},
				{ rootMargin: "400px" },
			);
			if (root.current) observer.observe(root.current);
		}
		return () => {
			controller.abort();
			observer?.disconnect();
		};
	}, [code, language]);
	const lines = code.split(/(\r\n|\n|\r)/);
	const tokens = result?.code === code && result.language === language ? result.lines : undefined;
	return (
		<pre ref={root} className="v-code-block__code">
			<code>
				{Array.from({ length: Math.ceil(lines.length / 2) }, (_, row) => {
					const text = lines[row * 2] ?? "";
					const ending = lines[row * 2 + 1] ?? "";
					const lineTokens = tokens?.[row];
					const intact = lineTokens?.map((token) => token.content).join("") === text;
					return (
						<Fragment key={row}>
							<span
								className="v-code-block__line"
								data-highlighted={highlightedLines.includes(row + 1) || undefined}
							>
								<span
									className="v-code-block__number"
									aria-hidden="true"
									data-line={row + 1}
								/>
								<span className="v-code-block__source">
									{intact
										? lineTokens?.map((token, index) => (
												<span
													key={index}
													style={{
														color: token.color,
														fontWeight:
															token.fontStyle !== undefined &&
															token.fontStyle & 2
																? 500
																: undefined,
														fontStyle:
															token.fontStyle !== undefined &&
															token.fontStyle & 1
																? "italic"
																: undefined,
													}}
												>
													{token.content}
												</span>
											))
										: text}
								</span>
							</span>
							{ending}
						</Fragment>
					);
				})}
			</code>
		</pre>
	);
}
