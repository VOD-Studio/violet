import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";

import { cn } from "@/shared/lib/utils";

import { schemaRefName } from "../lib/build-docs-model";
import type { DocOperation, OpenApiSchema } from "../model/types";
import { MethodBadge } from "./MethodBadge";
import { SchemaFields } from "./SchemaFields";

interface OperationRowProps {
	op: DocOperation;
	schemas: Record<string, OpenApiSchema>;
}

/**
 * 端点条目：方法徽章 + 路径 + 摘要一行，点击展开参数/请求体/响应详情。
 */
export function OperationRow({ op, schemas }: OperationRowProps) {
	const [open, setOpen] = useState(false);
	return (
		<div className="border-t border-paper-border/50 first:border-t-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				className="group flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper-foreground/[0.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
			>
				<MethodBadge method={op.method} className="translate-y-0.5 self-center" />
				<span className="min-w-0 flex-1 basis-full sm:basis-auto">
					<code className="block break-all font-mono text-[13px] leading-relaxed text-paper-foreground">
						{op.path}
					</code>
					{op.summary ? (
						<span className="mt-0.5 block text-xs leading-relaxed text-paper-muted">
							{op.summary}
						</span>
					) : null}
				</span>
				<ChevronDown
					className={cn(
						"size-4 shrink-0 self-center text-paper-muted/70 transition-transform duration-200 group-hover:text-paper-muted",
						open && "rotate-180",
					)}
				/>
			</button>
			{open ? (
				<div className="space-y-5 px-4 pt-1 pb-5 sm:pl-[5.25rem]">
					{op.description ? (
						<p className="max-w-prose text-xs leading-relaxed text-paper-muted">
							{op.description}
						</p>
					) : null}
					<OperationDetail op={op} schemas={schemas} />
				</div>
			) : null}
		</div>
	);
}

function OperationDetail({
	op,
	schemas,
}: {
	op: DocOperation;
	schemas: Record<string, OpenApiSchema>;
}) {
	const params = op.operation.parameters ?? [];
	const requestBody = op.operation.requestBody;
	const bodySchema = requestBody?.content?.["application/json"]?.schema;
	const responses = Object.entries(op.operation.responses ?? {}).sort(
		([a], [b]) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
	);

	return (
		<div className="space-y-5 font-sans">
			{params.length > 0 ? (
				<DetailSection label="参数">
					<dl className="divide-y divide-paper-border/60">
						{params.map((p) => (
							<div
								key={`${p.in}-${p.name}`}
								className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 py-1.5"
							>
								<dt className="min-w-0 break-all font-mono text-xs text-paper-foreground">
									{p.name}
									<span className="ml-1 text-[10px] text-paper-muted">
										({p.in})
									</span>
								</dt>
								<dd className="min-w-0 text-xs text-paper-muted">
									{p.description ?? ""}
									{p.required ? (
										<span className="ml-1 text-red-700 dark:text-red-400">
											*
										</span>
									) : null}
								</dd>
							</div>
						))}
					</dl>
				</DetailSection>
			) : null}

			{bodySchema ? (
				<DetailSection
					label={`请求体${schemaRefName(bodySchema) ? ` · ${schemaRefName(bodySchema)}` : ""}`}
				>
					<SchemaFields schema={bodySchema} schemas={schemas} />
				</DetailSection>
			) : null}

			{responses.length > 0 ? (
				<DetailSection label="响应">
					<div className="space-y-3">
						{responses.map(([status, res]) => {
							const schema = res.content?.["application/json"]?.schema;
							return (
								<div key={status}>
									<p className="font-mono text-xs text-paper-foreground">
										{status}
										{res.description ? (
											<span className="ml-2 font-sans text-paper-muted">
												{res.description}
											</span>
										) : null}
									</p>
									{schema ? (
										<div className="mt-1.5">
											<SchemaFields schema={schema} schemas={schemas} />
										</div>
									) : null}
								</div>
							);
						})}
					</div>
				</DetailSection>
			) : null}
		</div>
	);
}

function DetailSection({ label, children }: { label: string; children: ReactNode }) {
	return (
		<section>
			<h4 className="mb-1.5 font-serif text-xs font-semibold tracking-wide text-paper-foreground/80">
				{label}
			</h4>
			{children}
		</section>
	);
}
