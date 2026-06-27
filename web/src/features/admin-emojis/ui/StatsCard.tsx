import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import type { ReactNode } from "react";

interface StatsCardProps {
	title: string;
	value: number;
	icon: ReactNode;
	className?: string;
}

/**
 * StatsCard - 统计卡片
 *
 * 标题 + 数值 + 图标的紧凑统计展示，用于表情管理页顶部概览。
 */
export function StatsCard({ title, value, icon, className }: StatsCardProps) {
	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
				{icon}
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold">{value.toLocaleString()}</div>
			</CardContent>
		</Card>
	);
}
