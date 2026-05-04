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
import { Textarea } from "@/components/ui/textarea";

interface SiteInfoFormProps {
  form: Partial<SiteSettings>;
  updateField: (
    key: keyof SiteSettings,
    value: string | boolean | number,
  ) => void;
}

export function SiteInfoForm({ form, updateField }: SiteInfoFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>站点信息</CardTitle>
        <CardDescription>配置站点基本展示信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="site-name">站点名称</Label>
          <Input
            id="site-name"
            value={form.site_name ?? ""}
            onChange={(e) => updateField("site_name", e.target.value)}
            placeholder="请输入站点名称"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site-description">站点描述</Label>
          <Textarea
            id="site-description"
            value={form.site_description ?? ""}
            onChange={(e) => updateField("site_description", e.target.value)}
            placeholder="请输入站点描述"
            className="min-h-[80px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site-url">站点 URL</Label>
          <Input
            id="site-url"
            value={form.site_url ?? ""}
            onChange={(e) => updateField("site_url", e.target.value)}
            placeholder="https://example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-email">管理员邮箱</Label>
          <Input
            id="admin-email"
            type="email"
            value={form.admin_email ?? ""}
            onChange={(e) => updateField("admin_email", e.target.value)}
            placeholder="admin@example.com"
          />
        </div>
      </CardContent>
    </Card>
  );
}
