/**
 * URL 输入表单组件
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UrlInputProps {
  url: string;
  alt: string;
  onUrlChange: (url: string) => void;
  onAltChange: (alt: string) => void;
}

export function UrlInput({ url, alt, onUrlChange, onAltChange }: UrlInputProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="image-url">图片地址</Label>
        <Input
          id="image-url"
          placeholder="https://example.com/image.jpg"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="image-alt">替代文本（可选）</Label>
        <Input
          id="image-alt"
          placeholder="图片描述"
          value={alt}
          onChange={(e) => onAltChange(e.target.value)}
        />
      </div>
    </div>
  );
}
