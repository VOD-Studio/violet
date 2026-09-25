import { cn } from "cn";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";

import { schemaDisplayName, schemaRefName } from "../lib/build-docs-model";
import type { DocOperation, OpenApiSchema } from "../model/types";
import { MethodBadge } from "./MethodBadge";
import { SchemaFields } from "./SchemaFields";

interface OperationRowProps {
	op: DocOperation;
	schemas: Record<string, OpenApiSchema>;
}

/**
 * 可展开的端点词条：方法着色 + 路径 + 衬线摘要；展开区沿灰竖线缩进，
 * 开合走 grid-rows 过渡（收起不卸载已展开过的详情，保证双向动画）。
 */
export function OperationRow({ op, schemas }: OperationRowProps) {
	const reduceMotion = useReducedMotion();
	const [open, setOpen] = useState(false);
	const [hasOpened, setHasOpened] = useState(false);

	const toggle = () => {
		setHasOpened(true);
		setOpen((v) => !v);
	};

	return (
		<div>
			<button
				type="button"
				onClick={toggle}
				aria-expanded={open}
				className="group grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				<MethodBadge method={op.method} />
				<span className="min-w-0">
					<code className="block font-mono text-[13px] leading-snug font-medium break-all text-foreground/90 transition-colors group-hover:text-primary">
						{op.path}
					</code>
					{op.summary ? (
						<span className="mt-0.5 block font-serif text-xs leading-relaxed text-muted-foreground">
							{op.summary}
						</span>
					) : null}
				</span>
				{/* 旋转到 45° 时箭头包围盒膨胀到 ~20px 会撑出横向滚动条，定尺寸裁切就地消化 */}
				<span
					aria-hidden
					className="flex size-3.5 shrink-0 items-center justify-center overflow-clip"
				>
					<ArrowRight
						className={cn(
							"size-3.5 text-muted-foreground/40 transition-all duration-200 group-hover:text-muted-foreground",
							open && "rotate-90",
						)}
					/>
				</span>
			</button>
			<div
				className="grid"
				style={{
					gridTemplateRows: open ? "1fr" : "0fr",
					transition: reduceMotion ? undefined : "grid-template-rows 220ms ease-out",
				}}
			>
				<div className="overflow-hidden">
					{hasOpened ? (
						<div className="mb-5 ml-1 border-l border-border/40 pr-2 pb-1 pl-4 sm:pl-5">
							{op.description ? (
								<p className="mb-5 max-w-prose font-serif text-xs leading-relaxed text-muted-foreground">
									{op.description}
								</p>
							) : null}
							<OperationDetail op={op} schemas={schemas} />
						</div>
					) : null}
				</div>
			</div>
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
	const bodyRefName = schemaRefName(bodySchema);
	const responses = Object.entries(op.operation.responses ?? {}).sort(
		([a], [b]) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
	);

	return (
		<div className="space-y-6">
			{params.length > 0 ? (
				<DetailSection label="Parameters">
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
								<dd className="min-w-0 font-serif text-xs leading-5 text-muted-foreground">
									{parameter.description ?? ""}
									{parameter.required ? (
										<span className="ml-0.5 font-sans font-semibold text-red-500">
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
					label={`Request body${bodyRefName ? ` · ${schemaDisplayName(bodyRefName)}` : ""}`}
				>
					<SchemaFields schema={bodySchema} schemas={schemas} />
				</DetailSection>
			) : null}

			{responses.length > 0 ? (
				<DetailSection label="Responses">
					<div className="space-y-3">
						{responses.map(([status, response]) => {
							const schema = response.content?.["application/json"]?.schema;
							return (
								<div key={status}>
									<p className="font-mono text-xs font-semibold">
										{status}
										{response.description ? (
											<span className="ml-2 font-serif font-normal text-muted-foreground">
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
			<h4 className="font-mono text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/60 uppercase">
				{label}
			</h4>
			<div className="mt-3">{children}</div>
		</section>
	);
}
