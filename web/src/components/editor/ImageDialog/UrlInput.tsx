/**
 * URL 输入表单组件
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** UrlInput 组件的属性 */
interface UrlInputProps {
  /** 图片 URL */
  url: string;
  /** 替代文本 */
  alt: string;
  /** URL 变化回调 */
  onUrlChange: (url: string) => void;
  /** 替代文本变化回调 */
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
