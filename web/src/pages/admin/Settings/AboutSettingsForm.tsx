import type { SiteSettings } from "@/features/admin/settings/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AboutSettingsFormProps {
  form: Partial<SiteSettings>;
  updateField: (
    key: keyof SiteSettings,
    value: string | boolean | number,
  ) => void;
}

export function AboutSettingsForm({
  form,
  updateField,
}: AboutSettingsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>关于页配置</CardTitle>
        <CardDescription>
          配置关于页的个人简介和技术栈展示
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bio">个人简介</Label>
          <Textarea
            id="bio"
            value={form.bio ?? ""}
            onChange={(e) => updateField("bio", e.target.value)}
            placeholder="介绍一下自己吧..."
            rows={5}
          />
          <p className="text-xs text-muted-foreground">
            支持 Markdown 格式，留空将使用默认文案
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tech-stack">技术栈</Label>
          <Textarea
            id="tech-stack"
            value={form.tech_stack ?? ""}
            onChange={(e) => updateField("tech_stack", e.target.value)}
            placeholder={`JSON 格式，例如：\n[{"name":"前端","items":["React","TypeScript"]}]`}
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            JSON 数组格式，每个对象包含 <code>name</code>（分类名）和 <code>items</code>（技术列表）。留空将使用默认技术栈。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
