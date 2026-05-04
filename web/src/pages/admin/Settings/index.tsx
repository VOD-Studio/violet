import { useState, useEffect } from "react";
import { useSiteSettings, useSaveSettings } from "@/features/admin/settings";
import type { SiteSettings } from "@/features/admin/settings/types";
import { Button } from "@/components/ui/button";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { useToast } from "@/components/shared/Toast";
import { SettingsSkeleton } from "./SettingsSkeleton";
import { SiteInfoForm } from "./SiteInfoForm";
import { CommentSettingsForm } from "./CommentSettingsForm";
import { GitHubSettingsForm } from "./GitHubSettingsForm";
import { FooterSettingsForm } from "./FooterSettingsForm";

export default function Settings() {
  const { data: settings, isLoading, error, refetch } = useSiteSettings();
  const saveMutation = useSaveSettings();
  const { toast } = useToast();

  const [form, setForm] = useState<Partial<SiteSettings>>({});

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  function updateField(
    key: keyof SiteSettings,
    value: string | boolean | number
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    try {
      await saveMutation.mutateAsync(form);
      toast("设置已保存", "success");
    } catch {
      toast("保存失败，请重试", "error");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">站点设置</h1>
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
        <SettingsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">站点设置</h1>
        <ErrorFallback error={error.message} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">站点设置</h1>
          <p className="text-muted-foreground">配置站点基本信息和功能选项</p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "保存中..." : "保存设置"}
        </Button>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <SiteInfoForm form={form} updateField={updateField} />
        <CommentSettingsForm form={form} updateField={updateField} />
        <GitHubSettingsForm form={form} updateField={updateField} />
        <FooterSettingsForm form={form} updateField={updateField} />
      </div>
    </div>
  );
}
