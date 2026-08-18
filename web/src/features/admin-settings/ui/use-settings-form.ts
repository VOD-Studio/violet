import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import { type FieldValues, useForm } from "react-hook-form";

/**
 * 设置子页表单数据流:读分组配置 → useForm 回填 → 提交部分字段。
 *
 * @typeParam TField - 本子页表单值类型
 * @typeParam TData - 对应分组 DTO 类型
 * @param query - 本组配置查询(useGeneralSettings 等)
 * @param updateMut - 本组更新 mutation(useUpdateGeneral 等)
 * @param mapDataToForm - DTO → 表单值映射,仅 pick 本子页负责的字段并补默认值
 * @returns useForm 解构 + isLoading/onSubmit/isPending,供子页直接绑定
 */
export function useSettingsForm<TField extends FieldValues, TData>(
	query: UseQueryResult<TData>,
	updateMut: UseMutationResult<TData, Error, Partial<TData>>,
	mapDataToForm: (data: TData) => TField,
) {
	const { data, isLoading } = query;
	// 不传 defaultValues：首次 data 到达时由下方 reset 回填，避免 undefined 强转 TField。
	const form = useForm<TField>();
	// 解构 reset：react-hook-form 的方法引用稳定（不会每渲染变），
	// 用它做依赖避免把整个 form 对象放进依赖数组导致无限重渲染。
	const { reset } = form;

	// 仅在 data 变化时回填表单。mapDataToForm 是调用方内联闭包（每渲染新引用），
	// 列入依赖会触发无意义重置；reset 引用稳定。故只依赖 [data, reset]，exhaustive-deps 豁免 mapDataToForm。
	// biome-ignore lint/correctness/useExhaustiveDependencies: mapDataToForm 为内联闭包，仅 data 变化时回填
	useEffect(() => {
		if (data) {
			reset(mapDataToForm(data));
		}
	}, [data, reset]);

	// 表单值字段名与分组 DTO 字段名对齐（mapDataToForm 保证），直接透传给 mutation。
	const onSubmit = form.handleSubmit((values) =>
		updateMut.mutate(values as unknown as Partial<TData>),
	);

	return {
		...form,
		isLoading,
		isPending: updateMut.isPending,
		onSubmit,
	};
}
