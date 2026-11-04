import { AvatarPicker } from "@entities/media/ui/AvatarPicker";
import {
	useUpdateWindowSettings,
	useWindowCitySearch,
	useWindowSettings,
} from "@features/admin-settings/api/queries";
import type {
	WindowCityDTO,
	WindowPhotoSlot,
	WindowSettingsDTO,
} from "@features/admin-settings/model/types";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { useDebouncedValue } from "@shared/hooks/use-debounced-value";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Input } from "@violet/ui";
import { useState } from "react";

const SLOTS: { slot: WindowPhotoSlot; label: string }[] = [
	{ slot: "clear", label: "晴天" },
	{ slot: "cloudy", label: "阴天与雾天" },
	{ slot: "rain", label: "雨天" },
	{ slot: "snow", label: "雪天" },
	{ slot: "night", label: "夜里" },
];

const describeCity = (c: WindowCityDTO) =>
	[c.name, c.region, c.country].filter(Boolean).join(" · ");

function CitySearch({ onPick }: { onPick: (city: WindowCityDTO) => void }) {
	const [q, setQ] = useState("");
	const debounced = useDebouncedValue(q.trim(), 300);
	const { data, isFetching, isError } = useWindowCitySearch(debounced);

	return (
		<div className="space-y-2">
			<Input
				value={q}
				onChange={(e) => setQ(e.target.value)}
				placeholder="输入城市名，如 杭州"
				maxLength={40}
			/>
			{debounced && isError && (
				<p className="text-xs text-destructive">城市搜索暂时不可用，稍后再试</p>
			)}
			{debounced && !isError && data?.length === 0 && !isFetching && (
				<p className="text-xs text-muted-foreground">没有找到「{debounced}」</p>
			)}
			{data && data.length > 0 && (
				<ul className="space-y-1">
					{data.map((c) => (
						<li key={`${c.latitude},${c.longitude}`}>
							<button
								type="button"
								onClick={() => {
									onPick(c);
									setQ("");
								}}
								className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
							>
								<span>{describeCity(c)}</span>
								<span className="text-xs text-muted-foreground">{c.timezone}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function WindowSettingsPage() {
	const { watch, setValue, isLoading, isPending, onSubmit } = useSettingsForm<
		WindowSettingsDTO,
		WindowSettingsDTO
	>(useWindowSettings(), useUpdateWindowSettings(), (data) => ({
		city: data.city,
		photos: { ...data.photos },
	}));
	const city = watch("city");

	return (
		<SettingsSubPage
			title="窗"
			description="全站背景：访客隔着起雾的玻璃，看你那边此刻的天气"
			isLoading={isLoading}
			isPending={isPending}
			onSubmit={onSubmit}
		>
			<section className="space-y-4">
				<h3 className="text-sm font-semibold">你在哪座城市</h3>
				<p className="text-xs text-muted-foreground">
					天气每 15 分钟从 Open-Meteo
					更新一次；不填城市时，窗只画默认的景，不显示天气与时间。
				</p>
				{city ? (
					<div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-4 py-3">
						<div>
							<p className="text-sm font-medium">{describeCity(city)}</p>
							<p className="text-xs text-muted-foreground">
								{city.timezone} · {city.latitude.toFixed(2)},{" "}
								{city.longitude.toFixed(2)}
							</p>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setValue("city", null, { shouldDirty: true })}
						>
							清除
						</Button>
					</div>
				) : null}
				<Field label={city ? "换一座城市" : "搜索城市"}>
					<CitySearch onPick={(c) => setValue("city", c, { shouldDirty: true })} />
				</Field>
			</section>

			<section className="space-y-4">
				<h3 className="text-sm font-semibold">窗外的照片</h3>
				<p className="text-xs text-muted-foreground">
					每种天气一张，夜里不分天气用同一张。照片会被虚化成背景；没上传的用内置的默认景。
				</p>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
					{SLOTS.map(({ slot, label }) => (
						<div key={slot} className="flex flex-col items-start gap-1.5">
							<AvatarPicker
								shape="square"
								sizeClassName="aspect-[4/3] w-full"
								alt={`${label}的窗外`}
								pickerTitle={`选择${label}的窗外照片`}
								value={watch(`photos.${slot}`) ?? ""}
								onChange={(file) =>
									setValue(`photos.${slot}`, file?.url ?? "", {
										shouldDirty: true,
									})
								}
							/>
							<span className="text-sm">{label}</span>
						</div>
					))}
				</div>
			</section>
		</SettingsSubPage>
	);
}

export const Route = createFileRoute("/admin/settings/window")({
	component: WindowSettingsPage,
});
