import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@violet/ui";
import { formatUsageCost, formatUsageNumber, formatUsagePercent } from "../lib/usage-format";
import type { UsageModel } from "../model/usage";
import { SectionCard } from "./SectionCard";

/** 模型分布按服务端总 token 降序展示，窄屏保留横向滚动。 */
export function UsageModelsTable({ models }: { models: UsageModel[] }) {
	return (
		<SectionCard title="模型分布" description="按总 token 降序排列；成本为 USD API 等价估算。">
			<Table>
				<TableCaption>
					推理 token 已包含在输出中；平均速度不含失败或计时不完整的请求。
				</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead scope="col">提供商 / 模型</TableHead>
						<TableHead scope="col" className="text-right">
							请求
						</TableHead>
						<TableHead scope="col" className="text-right">
							总 token
						</TableHead>
						<TableHead scope="col" className="text-right">
							API 等价成本
						</TableHead>
						<TableHead scope="col" className="text-right">
							缓存率
						</TableHead>
						<TableHead scope="col" className="text-right">
							tokens/s
						</TableHead>
						<TableHead scope="col" className="text-right">
							错误
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{models.map((model) => (
						<TableRow key={JSON.stringify([model.provider, model.model])}>
							<TableHead scope="row" className="max-w-64 py-3 whitespace-normal">
								<span className="block wrap-anywhere">{model.model}</span>
								<span className="block wrap-anywhere text-xs font-normal text-muted-foreground">
									{model.provider}
								</span>
							</TableHead>
							<TableCell className="text-right tabular-nums">
								{formatUsageNumber(model.requests)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatUsageNumber(model.total_tokens)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatUsageCost(model.cost)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatUsagePercent(model.cache_rate)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatUsageNumber(model.avg_tokens_per_second)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatUsageNumber(model.errors)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</SectionCard>
	);
}
