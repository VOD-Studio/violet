import type { PersonaDraftLocalization } from "@features/persona-editor/model/types";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/base/card";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Textarea } from "@shared/ui/base/textarea";

interface PersonaIdentitySectionProps {
	localization: PersonaDraftLocalization;
	disabled: boolean;
	onChange: (patch: Pick<PersonaDraftLocalization, "name" | "subtitle" | "summary">) => void;
}

interface CharacterCountProps {
	value: string;
	max: number;
}

function CharacterCount({ value, max }: CharacterCountProps) {
	const count = Array.from(value).length;
	return (
		<span
			className={
				count > max
					? "text-xs tabular-nums text-destructive"
					: "text-xs tabular-nums text-muted-foreground"
			}
		>
			{count}/{max}
		</span>
	);
}

/** 角色名称、定位与公开简介编辑区。 */
export function PersonaIdentitySection({
	localization,
	disabled,
	onChange,
}: PersonaIdentitySectionProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>身份摘要</CardTitle>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-4">
						<Label htmlFor="persona-name">角色名称</Label>
						<CharacterCount value={localization.name} max={120} />
					</div>
					<Input
						id="persona-name"
						value={localization.name}
						disabled={disabled}
						aria-invalid={Array.from(localization.name).length > 120}
						placeholder="例如：若菫瑠爱｜RUA"
						onChange={(event) =>
							onChange({
								name: event.target.value,
								subtitle: localization.subtitle,
								summary: localization.summary,
							})
						}
					/>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-4">
						<Label htmlFor="persona-subtitle">角色定位</Label>
						<CharacterCount value={localization.subtitle} max={240} />
					</div>
					<Input
						id="persona-subtitle"
						value={localization.subtitle}
						disabled={disabled}
						aria-invalid={Array.from(localization.subtitle).length > 240}
						placeholder="一句话说明角色身份或气质"
						onChange={(event) =>
							onChange({
								name: localization.name,
								subtitle: event.target.value,
								summary: localization.summary,
							})
						}
					/>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-4">
						<Label htmlFor="persona-summary">身份简介</Label>
						<CharacterCount value={localization.summary} max={500} />
					</div>
					<Textarea
						id="persona-summary"
						value={localization.summary}
						disabled={disabled}
						aria-invalid={Array.from(localization.summary).length > 500}
						rows={5}
						placeholder="公开页首屏使用的简短人物介绍"
						onChange={(event) =>
							onChange({
								name: localization.name,
								subtitle: localization.subtitle,
								summary: event.target.value,
							})
						}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
