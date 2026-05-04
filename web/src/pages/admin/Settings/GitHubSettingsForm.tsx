import type { SiteSettings } from "@/features/admin/settings/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GitHubSettingsFormProps {
  form: Partial<SiteSettings>;
  updateField: (
    key: keyof SiteSettings,
    value: string | boolean | number,
  ) => void;
}

export function GitHubSettingsForm({
  form,
  updateField,
}: GitHubSettingsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub 配置</CardTitle>
        <CardDescription>
          配置 GitHub 用户名，用于展示贡献热力图和置顶仓库
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="github-username">GitHub 用户名</Label>
          <Input
            id="github-username"
            value={form.github_username ?? ""}
            onChange={(e) => updateField("github_username", e.target.value)}
            placeholder="请输入 GitHub 用户名"
          />
          <p className="text-xs text-muted-foreground">
            设置后将在关于页展示 GitHub 贡献热力图和置顶仓库
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
