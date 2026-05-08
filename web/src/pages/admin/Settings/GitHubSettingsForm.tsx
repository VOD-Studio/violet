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
          配置 GitHub 集成，用于展示贡献热力图和置顶仓库
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
        <div className="space-y-2">
          <Label htmlFor="github-token">GitHub Token</Label>
          <Input
            id="github-token"
            type="password"
            value={form.github_token ?? ""}
            onChange={(e) => updateField("github_token", e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
          />
          <p className="text-xs text-muted-foreground">
            用于调用 GitHub API 获取贡献数据，需勾选 <code>read:user</code> 权限。在 GitHub Settings → Developer settings → Tokens (classic) 中生成。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
