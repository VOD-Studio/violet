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

/** 可展开的端点条目：方法着色 + 路径 + 摘要，展开区沿 primary 竖线缩进。 */
export function OperationRow({ op, schemas }: OperationRowProps) {
	const [open, setOpen] = useState(false);
	return (
		<div>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				className="group grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left"
			>
				<MethodBadge method={op.method} />
				<span className="min-w-0">
					<code className="block font-mono text-[13px] leading-snug font-medium break-all text-foreground/90 transition-colors group-hover:text-primary">
						{op.path}
					</code>
					{op.summary ? (
						<span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
							{op.summary}
						</span>
					) : null}
				</span>
				<ChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:text-muted-foreground",
						open && "rotate-180",
					)}
				/>
			</button>
			{open ? (
				<div className="mb-4 ml-1 border-l-2 border-primary/25 pt-1 pr-2 pb-2 pl-4 sm:pl-5">
					{op.description ? (
						<p className="mb-5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
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
		<div className="space-y-5">
			{params.length > 0 ? (
				<DetailSection label="参数">
					<dl className="divide-y divide-border/30">
						{params.map((parameter) => (
							<div
								key={`${parameter.in}-${parameter.name}`}
								className="grid gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[minmax(7rem,auto)_1fr]"
							>
								<dt className="min-w-0 font-mono text-xs font-medium break-all">
									{parameter.name}
									<span className="ml-1 text-[10px] text-muted-foreground/60">
										({parameter.in})
									</span>
								</dt>
								<dd className="min-w-0 text-xs leading-5 text-muted-foreground">
									{parameter.description ?? ""}
									{parameter.required ? (
										<span className="ml-0.5 font-semibold text-red-500">*</span>
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
						{responses.map(([status, response]) => {
							const schema = response.content?.["application/json"]?.schema;
							return (
								<div key={status}>
									<p className="font-mono text-xs font-semibold">
										{status}
										{response.description ? (
											<span className="ml-2 font-sans font-normal text-muted-foreground">
												{response.description}
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
			<h4 className="mb-2 font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
				{label}
			</h4>
			{children}
		</section>
	);
}
