import { Card, CardContent, CardDescription, CardHeader } from "@shared/ui/card";

interface StatCardProps {
	label: string;
	value?: number;
}

/**
 * StatCard - 仪表盘统计卡片
 */
export function StatCard({ label, value }: StatCardProps) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardDescription>{label}</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="font-mono text-3xl font-bold">{value ?? 0}</p>
			</CardContent>
		</Card>
	);
}
