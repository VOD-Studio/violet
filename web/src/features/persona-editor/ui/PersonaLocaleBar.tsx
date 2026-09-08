import { MAX_PERSONA_LOCALES } from "@features/persona-editor/model/document";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import {
	COMMON_PERSONA_LOCALES,
	LocaleSwitcher,
	localeLabel,
	normalizeLocaleInput,
} from "@shared/ui/locale-switcher";
import { Check, Languages, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

interface PersonaLocaleBarProps {
	locales: readonly string[];
	value: string;
	defaultLocale: string;
	complete: boolean;
	disabled: boolean;
	onValueChange: (locale: string) => void;
	onAdd: (locale: string) => void;
	onSetDefault: (locale: string) => void;
	onRemove: (locale: string) => void;
}

/** 编辑器的语言版本导航与生命周期操作。 */
export function PersonaLocaleBar({
	locales,
	value,
	defaultLocale,
	complete,
	disabled,
	onValueChange,
	onAdd,
	onSetDefault,
	onRemove,
}: PersonaLocaleBarProps) {
	const [addOpen, setAddOpen] = useState(false);
	const [customLocale, setCustomLocale] = useState("");
	const [customError, setCustomError] = useState("");
	const canAdd = !disabled && locales.length < MAX_PERSONA_LOCALES;

	const closeAdd = () => {
		setAddOpen(false);
		setCustomLocale("");
		setCustomError("");
	};
	const addLocale = (rawLocale: string) => {
		const locale = normalizeLocaleInput(rawLocale);
		if (!locale) {
			setCustomError("请输入有效的 BCP 47 语言代码，例如 ja-JP");
			return;
		}
		if (locales.includes(locale)) {
			setCustomError("这个语言版本已经存在");
			return;
		}
		onAdd(locale);
		closeAdd();
	};

	return (
		<div className="flex flex-wrap items-center gap-3 rounded-xl border border-edge-hairline bg-card px-4 py-3 shadow-xs">
			<div className="flex min-w-36 items-center gap-2">
				<Languages className="size-4 text-muted-foreground" />
				<div>
					<p className="text-sm font-medium">语言版本</p>
					<p className="text-xs text-muted-foreground">当前编辑 {localeLabel(value)}</p>
				</div>
			</div>

			<LocaleSwitcher
				locales={locales}
				value={value}
				onValueChange={onValueChange}
				ariaLabel="切换正在编辑的人设语言"
				className="max-w-full flex-1"
			/>

			<div className="ml-auto flex flex-wrap items-center gap-2">
				<Badge variant={complete ? "secondary" : "outline"}>
					{complete ? <Check className="size-3" /> : null}
					{complete ? "公开资料完整" : "待补全"}
				</Badge>
				{value === defaultLocale ? (
					<Badge variant="outline">
						<Star className="size-3 fill-current" />
						默认语言
					</Badge>
				) : (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={disabled || !complete}
						onClick={() => onSetDefault(value)}
						title={complete ? "设为默认公开语言" : "补全当前语言后才能设为默认"}
					>
						<Star className="size-4" />
						设为默认
					</Button>
				)}

				<Popover
					open={addOpen}
					onOpenChange={(open) => {
						if (open) setAddOpen(true);
						else closeAdd();
					}}
				>
					<PopoverTrigger asChild>
						<Button type="button" variant="outline" size="sm" disabled={!canAdd}>
							<Plus className="size-4" />
							添加语言
						</Button>
					</PopoverTrigger>
					<PopoverContent
						align="end"
						sideOffset={8}
						className="w-96 max-w-[calc(100vw-2rem)] p-4"
					>
						<div>
							<p className="font-medium">添加语言版本</p>
							<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
								正文、资料与设定图分别维护，角色头像跨语言共用。
							</p>
						</div>
						<div className="mt-4 grid grid-cols-2 gap-2">
							{COMMON_PERSONA_LOCALES.filter(
								(locale) => !locales.includes(locale),
							).map((locale) => (
								<Button
									key={locale}
									type="button"
									variant="outline"
									className="h-auto justify-start px-3 py-2.5"
									onClick={() => addLocale(locale)}
								>
									<span>{localeLabel(locale)}</span>
									<span className="ml-auto font-mono text-[11px] text-muted-foreground">
										{locale}
									</span>
								</Button>
							))}
						</div>
						<div className="mt-4 space-y-2 border-t pt-4">
							<label htmlFor="persona-custom-locale" className="text-sm font-medium">
								其他语言代码
							</label>
							<div className="flex gap-2">
								<Input
									id="persona-custom-locale"
									value={customLocale}
									placeholder="例如 fr-FR"
									aria-invalid={Boolean(customError)}
									onChange={(event) => {
										setCustomLocale(event.target.value);
										setCustomError("");
									}}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											addLocale(customLocale);
										}
									}}
								/>
								<Button
									type="button"
									disabled={!customLocale.trim()}
									onClick={() => addLocale(customLocale)}
								>
									添加
								</Button>
							</div>
							{customError ? (
								<p className="text-xs text-destructive">{customError}</p>
							) : null}
						</div>
					</PopoverContent>
				</Popover>

				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					disabled={disabled || locales.length === 1 || value === defaultLocale}
					className="text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={() => onRemove(value)}
					aria-label={`移除${localeLabel(value)}版本`}
					title={
						value === defaultLocale
							? "先将其他语言设为默认，再移除此版本"
							: "移除语言版本"
					}
				>
					<Trash2 className="size-4" />
				</Button>
			</div>
		</div>
	);
}
