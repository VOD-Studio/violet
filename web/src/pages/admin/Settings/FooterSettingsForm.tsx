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

interface FooterSettingsFormProps {
  form: Partial<SiteSettings>;
  updateField: (
    key: keyof SiteSettings,
    value: string | boolean | number,
  ) => void;
}

export function FooterSettingsForm({
  form,
  updateField,
}: FooterSettingsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>页脚设置</CardTitle>
        <CardDescription>配置页面底部展示内容</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="footer-text">页脚文字</Label>
          <Input
            id="footer-text"
            value={form.footer_text ?? ""}
            onChange={(e) => updateField("footer_text", e.target.value)}
            placeholder="© 2026 My Blog"
          />
        </div>
      </CardContent>
    </Card>
  );
}
