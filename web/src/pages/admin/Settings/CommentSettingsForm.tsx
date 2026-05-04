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

interface CommentSettingsFormProps {
  form: Partial<SiteSettings>;
  updateField: (
    key: keyof SiteSettings,
    value: string | boolean | number,
  ) => void;
}

export function CommentSettingsForm({
  form,
  updateField,
}: CommentSettingsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>评论设置</CardTitle>
        <CardDescription>配置评论审核和展示策略</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="comments-enabled"
            checked={form.comments_enabled ?? true}
            onChange={(e) => updateField("comments_enabled", e.target.checked)}
            className="size-4 rounded border"
          />
          <Label htmlFor="comments-enabled" className="cursor-pointer">
            启用评论功能
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="comments-moderation"
            checked={form.comments_moderation ?? true}
            onChange={(e) =>
              updateField("comments_moderation", e.target.checked)
            }
            className="size-4 rounded border"
          />
          <Label htmlFor="comments-moderation" className="cursor-pointer">
            评论需要审核
          </Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="posts-per-page">每页文章数</Label>
          <Input
            id="posts-per-page"
            type="number"
            min="1"
            max="50"
            value={form.posts_per_page ?? 10}
            onChange={(e) =>
              updateField("posts_per_page", parseInt(e.target.value) || 10)
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
