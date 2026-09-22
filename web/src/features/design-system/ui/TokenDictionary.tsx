import { useEffect, useState } from "react";
import { readTokenValue, type TokenDomain, type TokenValue } from "../model/probe";
import { ALL_TOKENS, TOKEN_GROUPS } from "../model/tokens";

type TokenValues = Map<string, Record<TokenDomain, TokenValue>>;

/**
 * 色样：底色来自探针实时值（色板可插拔，换预设自动跟随），
 * 读不到渲染透明占位。title 携带原始值供悬停查证。
 */
function TokenSwatch({ value }: { value: TokenValue }) {
	return (
		<span
			className="inline-block size-5 rounded-2 border border-border/60"
			style={{ backgroundColor: value.hex ?? "transparent" }}
			title={value.raw ?? "未定义"}
		/>
	);
}

/**
 * token 词典章内容：六个分组陈列全部映射层 token 的名称、用途与明暗双域实时值。
 *
 * 色值在挂载后探针读取（getComputedStyle 需浏览器），SSR 与首帧渲染「—」占位。
 */
export function TokenDictionary() {
	const [values, setValues] = useState<TokenValues>(new Map());

	useEffect(() => {
		const next: TokenValues = new Map();
		for (const token of ALL_TOKENS) {
			next.set(token.varName, {
				light: readTokenValue(token.varName, "light"),
				dark: readTokenValue(token.varName, "dark"),
			});
		}
		setValues(next);
	}, []);

	return (
		<div className="mt-8 space-y-10">
			{TOKEN_GROUPS.map((group) => (
				<section aria-label={group.title} key={group.id}>
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<h3 className="text-lg font-bold">{group.title}</h3>
						<p className="text-sm text-muted-foreground">{group.note}</p>
					</div>
					<ul className="mt-4">
						{group.tokens.map((token) => {
							const value = values.get(token.varName);
							return (
								<li
									className="grid grid-cols-[3.75rem_1fr] items-baseline gap-x-4 border-b border-border/40 py-2.5 sm:grid-cols-[3.75rem_1fr_1.5fr]"
									key={token.varName}
								>
									<span className="flex gap-1.5 self-center">
										<TokenSwatch
											value={value?.light ?? { raw: null, hex: null }}
										/>
										<TokenSwatch
											value={value?.dark ?? { raw: null, hex: null }}
										/>
									</span>
									<span className="min-w-0">
										<code className="font-mono text-xs">{token.varName}</code>
										<span
											className="block truncate font-mono text-[10px] text-muted-foreground"
											title={
												value
													? `${value.light.hex ?? "—"} · ${value.dark.hex ?? "—"}`
													: "—"
											}
										>
											{value
												? `${value.light.hex ?? "—"} · ${value.dark.hex ?? "—"}`
												: "—"}
										</span>
									</span>
									<span className="col-span-2 text-sm leading-relaxed text-muted-foreground sm:col-span-1">
										{token.purpose}
									</span>
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</div>
	);
}
