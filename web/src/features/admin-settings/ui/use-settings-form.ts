import { useAdminSettings, useUpdateSettings } from "@features/admin-settings/api/queries";
import type { SiteSettingsDTO } from "@features/admin-settings/model/types";
import { useEffect } from "react";
import { type FieldValues, useForm } from "react-hook-form";

/**
 * useSettingsForm - 设置子页表单数据流封装
 *
 * 各设置子页共享同一数据流：读 useAdminSettings → useForm 回填 → 提交部分字段。
 * 本 hook 消除 6 个子页重复的 useAdminSettings/useForm/useEffect 样板。
 *
 * @param mapDataToForm 把后端 SiteSettingsDTO 映射为本子页的表单值（含默认值处理）。
 *                     仅 pick 本子页负责的字段；表单类型 T 约束提交范围。
 * @returns useForm 解构 + isLoading/onSubmit/isPending，供子页直接绑定。
 */
export function useSettingsForm<T extends FieldValues>(
    mapDataToForm: (data: SiteSettingsDTO) => T,
) {
    const { data, isLoading } = useAdminSettings();
    const updateMut = useUpdateSettings();
    // 不传 defaultValues：首次 data 到达时由下方 reset 回填，避免 undefined 强转 T。
    const form = useForm<T>();

    // mapDataToForm 是调用方内联函数（每次渲染新引用），列入依赖会导致无意义重置；
    // 这里有意只在 data 变化时回填，故豁免 exhaustive-deps。
    // biome-ignore lint/correctness/useExhaustiveDependencies: mapDataToForm 为内联闭包，仅 data 变化时回填
    useEffect(() => {
        if (data) {
            form.reset(mapDataToForm(data));
        }
    }, [data, form]);

    const onSubmit = form.handleSubmit((values) => updateMut.mutate(values));

    return {
        ...form,
        isLoading,
        isPending: updateMut.isPending,
        onSubmit,
    };
}
