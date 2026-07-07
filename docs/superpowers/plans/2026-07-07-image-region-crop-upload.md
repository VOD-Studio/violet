# 图片选区裁剪上传 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `Cover` 和 `AvatarUploader`(以及素材库上传单图)支持选区裁剪上传——静态图 canvas 重编码上传、GIF 存坐标 + CSS 视觉裁剪保留动画。

**Architecture:** 纯前端零后端改动。公共纯 UI 进 `shared/ui/image-cropper/`(选区交互 + 视觉裁剪显示);编排逻辑(GIF 判定 + 静态图重编码 + 分片上传)进 `features/upload/ui/CropUploadDialog.tsx`;坐标编码进 URL 查询参数 `?crop=x,y,w,h`。三个接入点(AvatarUploader / 素材库单图 / Cover)各自独立接入。

**Tech Stack:** React 19、react-easy-crop(新增)、canvas 2D `drawImage`/`toBlob`、既有 `useChunkedUpload` 分片上传链路、Vitest + jsdom、Biome、Tailwind v4。

**Reference spec:** `docs/superpowers/specs/2026-07-07-image-region-crop-upload-design.md`

**Conventions (AGENTS.md):**
- 包管理器是 **pnpm**(严禁 npm/yarn)
- 测试 `make web-test`,类型检查 `make web-typecheck`,lint `make web-lint`,格式化 `make web-format`
- 提交信息中文,Conventional Commits,body 用 bullet points,**不要 push**
- 公共组件单独提交;组件改动 vs 页面接入分开提;前后端分离(本计划纯前端,无此约束)

---

## File Structure

| 文件 | 责任 | 动作 |
|------|------|------|
| `web/package.json` | 新增 react-easy-crop 依赖 | 改 |
| `web/src/features/upload/lib/cropUrl.ts` | `withCrop` / `parseCrop` 坐标↔URL 编码 | 新建 |
| `web/src/features/upload/lib/__tests__/cropUrl.test.ts` | 上述纯函数单测 | 新建 |
| `web/src/shared/ui/image-cropper/lib/crop-to-style.ts` | transform 纯函数(rect + 容器比例 → CSS style) | 新建 |
| `web/src/shared/ui/image-cropper/lib/__tests__/crop-to-style.test.ts` | 上述纯函数单测 | 新建 |
| `web/src/shared/ui/image-cropper/ImageCropper.tsx` | react-easy-crop 包装,选区交互 | 新建 |
| `web/src/shared/ui/image-cropper/CroppedImage.tsx` | 显示层 CSS 视觉裁剪 | 新建 |
| `web/src/shared/ui/image-cropper/index.ts` | barrel 导出 | 新建 |
| `web/src/features/upload/lib/imageUrl.ts` | `avatarUrl` 对 GIF 剥除处理参数 | 改 |
| `web/src/features/upload/lib/__tests__/imageUrl.test.ts` | avatarUrl GIF 分支单测 | 新建 |
| `web/src/features/upload/lib/crop-image.ts` | canvas 重编码纯函数(`cropImageToBlob`) | 新建 |
| `web/src/features/upload/ui/CropUploadDialog.tsx` | 编排弹窗:判 GIF + 重编码 + 上传 | 新建 |
| `web/src/features/upload/ui/AvatarUploader.tsx` | 接入 CropUploadDialog + CroppedImage | 改 |
| `web/src/routes/admin.media.tsx` | 素材库上传单图接 CropUploadDialog | 改 |
| `web/src/features/admin-media/ui/Cover.tsx` | MediaPicker 选完进裁剪 + CroppedImage | 改 |

---

## Task 1: 引入 react-easy-crop 依赖

**Files:**
- Modify: `web/package.json`, `web/pnpm-lock.yaml`

- [ ] **Step 1: 安装依赖**

Run:
```bash
cd web && pnpm add react-easy-crop
```

- [ ] **Step 2: 验证安装成功**

Run:
```bash
cd web && node -e "console.log(require('./node_modules/react-easy-crop/package.json').version)"
```
Expected: 打印版本号(如 `5.x.x`),无报错。

- [ ] **Step 3: 类型检查确保无破坏**

Run: `make web-typecheck`
Expected: PASS(新增依赖不影响现有类型)

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml
git commit -m "chore(web): 引入 react-easy-crop 依赖

- pnpm add react-easy-crop,用于图片选区裁剪交互
- 依赖变更独立提交,可单独回滚"
```

---

## Task 2: 坐标 URL 编码工具 `cropUrl.ts`

**Files:**
- Create: `web/src/features/upload/lib/cropUrl.ts`
- Test: `web/src/features/upload/lib/__tests__/cropUrl.test.ts`

- [ ] **Step 1: 写失败测试**

Create `web/src/features/upload/lib/__tests__/cropUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCrop, withCrop, type CropRect } from "../cropUrl";

describe("withCrop", () => {
    const rect: CropRect = { x: 0.1, y: 0.2, w: 0.5, h: 0.6 };

    it("给裸 path 附加 crop 参数", () => {
        expect(withCrop("/uploads/a.gif", rect)).toBe(
            "/uploads/a.gif?crop=0.1,0.2,0.5,0.6",
        );
    });

    it("保留已有查询参数", () => {
        expect(withCrop("/uploads/a.gif?w=200", rect)).toBe(
            "/uploads/a.gif?w=200&crop=0.1,0.2,0.5,0.6",
        );
    });

    it("覆盖已有 crop 参数(幂等)", () => {
        const once = withCrop("/uploads/a.gif", rect);
        const twice = withCrop(once, { x: 0, y: 0, w: 1, h: 1 });
        expect(twice).toBe("/uploads/a.gif?crop=0,0,1,1");
    });

    it("四舍六入到 4 位小数", () => {
        expect(
            withCrop("/uploads/a.gif", {
                x: 0.123456,
                y: 0.00001,
                w: 0.999999,
                h: 0.5,
            }),
        ).toBe("/uploads/a.gif?crop=0.1235,0,1,0.5");
    });
});

describe("parseCrop", () => {
    it("解析有 crop 参数的 URL", () => {
        expect(parseCrop("/uploads/a.gif?crop=0.1,0.2,0.5,0.6")).toEqual({
            x: 0.1,
            y: 0.2,
            w: 0.5,
            h: 0.6,
        });
    });

    it("URL 有其他参数时仍能解析 crop", () => {
        expect(parseCrop("/uploads/a.gif?w=200&crop=0.1,0.2,0.5,0.6")).toEqual({
            x: 0.1,
            y: 0.2,
            w: 0.5,
            h: 0.6,
        });
    });

    it("无 crop 参数返回 null", () => {
        expect(parseCrop("/uploads/a.gif?w=200")).toBeNull();
    });

    it("非法 crop 值返回 null", () => {
        expect(parseCrop("/uploads/a.gif?crop=abc")).toBeNull();
    });

    it("超界值返回 null", () => {
        expect(parseCrop("/uploads/a.gif?crop=1.5,0,0.5,0.5")).toBeNull();
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd web && pnpm vitest run src/features/upload/lib/__tests__/cropUrl.test.ts`
Expected: FAIL(`withCrop`/`parseCrop` 未定义)

- [ ] **Step 3: 实现 cropUrl.ts**

Create `web/src/features/upload/lib/cropUrl.ts`:

```ts
/**
 * 裁剪坐标的 URL 编码工具。
 *
 * GIF 选区不重编码文件,改为把归一化坐标(相对原图 0~1)编码进 URL 查询参数
 * `?crop=x,y,w,h`,显示层用 CSS 视觉裁剪聚焦选区。
 *
 * 与 imageUrl.ts 的动态处理参数(w/thumb/format 等)正交:后端 transformer
 * 只读已知参数,会忽略 crop,因此本参数纯前端约定。
 */

/** 归一化裁剪区域(相对原图,0~1) */
export interface CropRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

function round(n: number): number {
    return Math.round(n * 10000) / 10000;
}

function isValidRect(rect: CropRect): boolean {
    return (
        rect.x >= 0 &&
        rect.x <= 1 &&
        rect.y >= 0 &&
        rect.y <= 1 &&
        rect.w > 0 &&
        rect.w <= 1 &&
        rect.h > 0 &&
        rect.h <= 1 &&
        rect.x + rect.w <= 1.0001 &&
        rect.y + rect.h <= 1.0001
    );
}

/**
 * 给 URL 附加(或覆盖)`?crop=x,y,w,h` 参数。
 * 保留其他查询参数,幂等。
 */
export function withCrop(path: string, rect: CropRect): string {
    const [base, search = ""] = path.split("?");
    const params = new URLSearchParams(search);
    params.set(
        "crop",
        `${round(rect.x)},${round(rect.y)},${round(rect.w)},${round(rect.h)}`,
    );
    return `${base}?${params.toString()}`;
}

/**
 * 从 URL 解析 crop 参数。无或非法时返回 null。
 */
export function parseCrop(url: string): CropRect | null {
    const searchIdx = url.indexOf("?");
    if (searchIdx < 0) return null;
    const params = new URLSearchParams(url.slice(searchIdx + 1));
    const raw = params.get("crop");
    if (!raw) return null;
    const parts = raw.split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
    const rect: CropRect = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    return isValidRect(rect) ? rect : null;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd web && pnpm vitest run src/features/upload/lib/__tests__/cropUrl.test.ts`
Expected: PASS(全部用例)

- [ ] **Step 5: Commit**

```bash
git add web/src/features/upload/lib/cropUrl.ts web/src/features/upload/lib/__tests__/cropUrl.test.ts
git commit -m "feat(web): 新增坐标 URL 编码工具 withCrop/parseCrop

- 归一化坐标(0~1)编码进 ?crop=x,y,w,h 查询参数
- 保留已有查询参数,幂等覆盖
- 解析含边界校验,非法/超界返回 null
- 用于 GIF 选区存坐标,CSS 视觉裁剪保留动画"
```

---

## Task 3: CSS 视觉裁剪 transform 纯函数 `crop-to-style.ts`

**Files:**
- Create: `web/src/shared/ui/image-cropper/lib/crop-to-style.ts`
- Test: `web/src/shared/ui/image-cropper/lib/__tests__/crop-to-style.test.ts`

- [ ] **Step 1: 写失败测试**

Create `web/src/shared/ui/image-cropper/lib/__tests__/crop-to-style.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cropToStyle } from "../crop-to-style";

describe("cropToStyle", () => {
    it("无选区(默认全图)返回单位 transform", () => {
        expect(cropToStyle(undefined, 16 / 9)).toEqual({
            transform: "translate(0%, 0%) scale(1)",
        });
    });

    it("正方形选区 + 正方形容器:scale 到铺满,scale = 1/h", () => {
        // 选区 50% 居中:rect={x:0.25,y:0.25,w:0.5,h:0.5},容器 1:1
        // 选区宽高比 1,容器宽高比 1 → scale = 1/0.5 = 2
        // 选区在图片中心 → translate(0,0)
        const style = cropToStyle({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 1);
        expect(style.transform).toContain("scale(2)");
    });

    it("宽选区 + 高容器:按高度铺满", () => {
        // 选区宽高比 2(w=0.8,h=0.4),容器 1:1(宽高比 1)
        // 容器更窄 → 受限于高度:scale = 1/0.4 = 2.5
        const style = cropToStyle({ x: 0.1, y: 0.3, w: 0.8, h: 0.4 }, 1);
        expect(style.transform).toContain("scale(2.5)");
    });

    it("高选区 + 宽容器:按宽度铺满", () => {
        // 选区宽高比 0.5(w=0.4,h=0.8),容器 16:9(≈1.78)
        // 容器更宽 → 受限于宽度:scale = 1/0.4 = 2.5
        const style = cropToStyle({ x: 0.3, y: 0.1, w: 0.4, h: 0.8 }, 16 / 9);
        expect(style.transform).toContain("scale(2.5)");
    });

    it("居中选区 translate 接近 0%", () => {
        // 选区居中:x+w/2 = 0.5, y+h/2 = 0.5
        const style = cropToStyle({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 1);
        expect(style.transform).toContain("translate(0%, 0%)");
    });

    it("左上角选区 translate 为负(图片向右下移)", () => {
        const style = cropToStyle({ x: 0, y: 0, w: 0.5, h: 0.5 }, 1);
        // 选区中心在 (0.25,0.25),容器中心要的图片位置(0.25,0.25)
        // translate 把图片中心对齐:负方向
        expect(style.transform).toMatch(/translate\(-?\d+(\.\d+)?%, -?\d+(\.\d+)?%\)/);
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd web && pnpm vitest run src/shared/ui/image-cropper/lib/__tests__/crop-to-style.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现 crop-to-style.ts**

Create `web/src/shared/ui/image-cropper/lib/crop-to-style.ts`:

```ts
import type { CSSProperties } from "react";
import type { CropRect } from "@features/upload/lib/cropUrl";

/**
 * 把归一化裁剪区域 + 容器宽高比,换算成 CSS transform。
 *
 * 原理(object-fit:cover 下的视觉聚焦):
 * - 容器套选区,选区要铺满容器,取缩放更大的方向(scale = max(1/w, 1/h) 按容器宽高比修正)
 * - 选区中心对齐容器中心,translate 让图片反向移动
 *
 * 这样浏览器仍加载完整原图(GIF 动画保留),但视觉上聚焦到选区,
 * 实现无损的「视觉裁剪」。
 */
export function cropToStyle(
    rect: CropRect | undefined,
    containerAspect: number,
): Pick<CSSProperties, "transform"> {
    // 无选区:图片自然铺满(object-cover 已处理)
    if (!rect) {
        return { transform: "translate(0%, 0%) scale(1)" };
    }

    const rectAspect = rect.w / rect.h;
    let scale: number;
    if (rectAspect > containerAspect) {
        // 选区比容器宽:高度铺满,scale = 1/h
        scale = 1 / rect.h;
    } else {
        // 选区比容器高(或相等):宽度铺满,scale = 1/w
        scale = 1 / rect.w;
    }

    // 选区中心(归一化)相对图片中心(0.5)的偏移,放大 scale 后转成图片自身百分比
    // 图片自身宽 = 1 * scale,要让选区中心落到容器中心
    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;
    // translate 百分比相对图片自身尺寸
    const tx = (0.5 - centerX) * 100;
    const ty = (0.5 - centerY) * 100;

    return {
        transform: `translate(${tx}%, ${ty}%) scale(${scale})`,
    };
}
```

> 注:`shared` 层依赖 `features/upload/lib` 的类型(仅 `type` import,编译期擦除)。如果你希望 shared 完全不引用 features,可在 `shared/ui/image-cropper/lib/types.ts` 单独定义 `CropRect`,由 `features/upload/lib/cropUrl.ts` re-export。本计划采用直接 type import 简化,因为 `CropRect` 是通用几何类型且仅类型层面耦合。**实现时若 lint 报循环依赖或分层警告,改用 types.ts 方案。**

- [ ] **Step 4: 运行测试确认通过**

Run: `cd web && pnpm vitest run src/shared/ui/image-cropper/lib/__tests__/crop-to-style.test.ts`
Expected: PASS

> 如 translate 符号或 scale 方向与预期不符,调试时用浏览器手动验证一个 16:9 容器 + 居中选区场景,定准公式后回填测试。**公式以测试断言为准。**

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/ui/image-cropper/lib/
git commit -m "feat(web): 新增 cropToStyle 视觉裁剪 transform 纯函数

- 把归一化选区 + 容器比例换算成 CSS transform
- object-fit:cover 下聚焦选区中心,GIF 原图不动保留动画
- 无选区返回单位 transform,兼容普通图片
- 含宽/高选区、居中/偏移场景单测"
```

---

## Task 4: `ImageCropper` 选区交互组件

**Files:**
- Create: `web/src/shared/ui/image-cropper/ImageCropper.tsx`

- [ ] **Step 1: 实现组件**

Create `web/src/shared/ui/image-cropper/ImageCropper.tsx`:

```tsx
import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import type { CropRect } from "@features/upload/lib/cropUrl";

export interface ImageCropperProps {
    /** 图片源(object URL 或远程 URL) */
    src: string;
    /** 选区宽高比;undefined 为自由比例 */
    aspect?: number;
    /** 选区变化回调(归一化坐标);需在图片加载后才有自然尺寸可归一化 */
    onChange: (rect: CropRect | undefined) => void;
}

/**
 * ImageCropper - 基于 react-easy-crop 的选区交互组件。
 *
 * 输出归一化 CropRect(0~1):react-easy-crop 给像素坐标,组件内用图片
 * 自然宽高归一化。归一化后可编码进 URL,与图片实际尺寸解耦。
 */
export function ImageCropper({ src, aspect, onChange }: ImageCropperProps) {
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

    const onImgLoad = useCallback(
        (e: React.SyntheticEvent<HTMLImageElement>) => {
            const img = e.currentTarget;
            setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        },
        [],
    );

    const onCropComplete = useCallback(
        (_area: Area, areaPixels: Area) => {
            if (!naturalSize || naturalSize.w === 0 || naturalSize.h === 0) return;
            onChange({
                x: areaPixels.x / naturalSize.w,
                y: areaPixels.y / naturalSize.h,
                w: areaPixels.width / naturalSize.w,
                h: areaPixels.height / naturalSize.h,
            });
        },
        [naturalSize, onChange],
    );

    return (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <Cropper
                image={src}
                aspect={aspect}
                onImgLoad={onImgLoad}
                onCropComplete={onCropComplete}
                objectFit="horizontal-cover"
            />
        </div>
    );
}
```

> 注:`objectFit` 用 `horizontal-cover` 还是默认 `contain` 视图片方向;对头像(1:1)与封面(16:9)默认即可,实现时按 react-easy-crop 文档调。容器用 `aspect-video` 占位,实际由调用方外壳控制。

- [ ] **Step 2: 类型检查**

Run: `make web-typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/shared/ui/image-cropper/ImageCropper.tsx
git commit -m "feat(web): 新增 ImageCropper 选区交互组件

- 基于 react-easy-crop 封装,输出归一化 CropRect(0~1)
- 图片自然尺寸加载后归一化像素坐标
- 支持固定 aspect(封面 16:9、头像 1:1)与自由比例"
```

---

## Task 5: `CroppedImage` 视觉裁剪显示组件 + barrel

**Files:**
- Create: `web/src/shared/ui/image-cropper/CroppedImage.tsx`
- Create: `web/src/shared/ui/image-cropper/index.ts`

- [ ] **Step 1: 实现 CroppedImage**

Create `web/src/shared/ui/image-cropper/CroppedImage.tsx`:

```tsx
import { useMemo } from "react";
import { parseCrop } from "@features/upload/lib/cropUrl";
import { cropToStyle } from "./lib/crop-to-style";
import { cn } from "@/shared/lib/utils";

export interface CroppedImageProps {
    /** 图片 src,可能带 ?crop=x,y,w,h */
    src: string;
    /** 容器宽高比(数字);不传则不强制比例 */
    aspect?: number;
    /** 容器 className */
    className?: string;
    /** img alt */
    alt?: string;
}

/**
 * CroppedImage - 显示层视觉裁剪。
 *
 * 解析 src 上的 ?crop= 参数,用 CSS transform 把原图聚焦到选区。
 * 无 crop 参数时退化为普通 object-cover 图片。
 *
 * GIF 场景:原图完整加载,动画保留,仅视觉聚焦——无损。
 */
export function CroppedImage({ src, aspect, className, alt = "" }: CroppedImageProps) {
    const rect = useMemo(() => parseCrop(src), [src]);
    // 用 src 的查询参数外的 path 作为实际加载源(parseCrop 已确认 crop 纯前端约定)
    // 但实际浏览器加载 src 全文即可,后端忽略 crop;无需剥离
    const style = useMemo(
        () => cropToStyle(rect, aspect ?? rect?.w / rect?.h ?? 16 / 9),
        [rect, aspect],
    );

    return (
        <div
            className={cn("overflow-hidden", className)}
            style={aspect ? { aspectRatio: aspect } : undefined}
        >
            <img
                src={src}
                alt={alt}
                className="h-full w-full object-cover will-change-transform"
                style={style}
            />
        </div>
    );
}
```

- [ ] **Step 2: 写 barrel index.ts**

Create `web/src/shared/ui/image-cropper/index.ts`:

```ts
export { ImageCropper, type ImageCropperProps } from "./ImageCropper";
export { CroppedImage, type CroppedImageProps } from "./CroppedImage";
```

- [ ] **Step 3: 类型检查 + lint**

Run: `make web-typecheck && make web-lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/src/shared/ui/image-cropper/CroppedImage.tsx web/src/shared/ui/image-cropper/index.ts
git commit -m "feat(web): 新增 CroppedImage 视觉裁剪显示组件

- 解析 src 上的 ?crop= 参数,用 CSS transform 聚焦选区
- 无 crop 参数退化为普通 object-cover,零破坏性接入
- GIF 原图完整加载,动画保留
- 同步导出 image-cropper barrel"
```

---

## Task 6: `avatarUrl` 对 GIF 剥除处理参数

**Files:**
- Modify: `web/src/features/upload/lib/imageUrl.ts:34-41`
- Test: `web/src/features/upload/lib/__tests__/imageUrl.test.ts`

- [ ] **Step 1: 写失败测试**

Create `web/src/features/upload/lib/__tests__/imageUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { avatarUrl } from "../imageUrl";

describe("avatarUrl", () => {
    it("空 path 返回默认头像", () => {
        expect(avatarUrl("", "alice")).toContain("ui-avatars.com");
    });

    it("静态图追加 w/thumb/format 参数", () => {
        const url = avatarUrl("/uploads/avatar/x.webp", "alice");
        expect(url).toContain("w=200");
        expect(url).toContain("thumb=200x200");
        expect(url).toContain("format=webp");
    });

    it("GIF 剥除所有处理参数,保留原 path(保护动画)", () => {
        const url = avatarUrl("/uploads/avatar/a.gif", "alice");
        expect(url).toBe("/uploads/avatar/a.gif");
        expect(url).not.toContain("format=webp");
        expect(url).not.toContain("w=200");
        expect(url).not.toContain("thumb");
    });

    it("GIF path 上已有的 crop 参数保留", () => {
        const url = avatarUrl("/uploads/avatar/a.gif?crop=0.1,0.2,0.5,0.5", "alice");
        expect(url).toContain("crop=0.1,0.2,0.5,0.5");
        expect(url).not.toContain("format=webp");
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd web && pnpm vitest run src/features/upload/lib/__tests__/imageUrl.test.ts`
Expected: FAIL(GIF 用例会拿到带 format=webp 的 URL)

- [ ] **Step 3: 改 avatarUrl**

Modify `web/src/features/upload/lib/imageUrl.ts`,替换 `avatarUrl` 函数(line 34-41):

```ts
/**
 * 头像专用:200x200 缩略图 + WebP
 * 如果 path 为空或无效,返回默认头像(使用 UI Avatars 生成)
 *
 * GIF 特判:剥除所有后端处理参数(format=webp 会让后端只取第一帧,
 * 动画静默丢失),只返回原 path(含已有的 ?crop=),动画完整保留。
 */
export function avatarUrl(path: string, username?: string): string {
    if (!path || path.trim() === "") {
        const name = username ? encodeURIComponent(username) : "User";
        return `https://ui-avatars.com/api/?name=${name}&size=200&background=random`;
    }
    if (isGifPath(path)) {
        return path;
    }
    return imageUrl(path, { w: 200, thumb: "200x200", format: "webp" });
}

/** 判断 path(剥离查询参数后)是否 .gif 后缀 */
function isGifPath(path: string): boolean {
    const base = path.split("?")[0];
    return base.toLowerCase().endsWith(".gif");
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd web && pnpm vitest run src/features/upload/lib/__tests__/imageUrl.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/features/upload/lib/imageUrl.ts web/src/features/upload/lib/__tests__/imageUrl.test.ts
git commit -m "feat(web): avatarUrl 对 GIF 剥除处理参数保护动画

- GIF path 直接返回原 URL,不追加 w/thumb/format
- format=webp 会让后端解码 GIF 取第一帧,动画丢失
- 静态图头像仍走 200x200 webp 缩略图
- 保留 GIF path 上已有的 ?crop 参数"
```

---

## Task 7: canvas 重编码工具 `crop-image.ts`

**Files:**
- Create: `web/src/features/upload/lib/crop-image.ts`

- [ ] **Step 1: 实现 cropImageToBlob**

Create `web/src/features/upload/lib/crop-image.ts`:

```ts
import type { CropRect } from "./cropUrl";

/**
 * 把图片 src 按归一化选区裁剪,canvas 重编码为 WebP Blob。
 *
 * 仅用于静态图(jpeg/png/webp)。GIF 不走此路径(动画会丢失)。
 *
 * 原理:Image 加载完整图 → canvas 尺寸=选区像素 → drawImage 只画选区 → toBlob("image/webp")
 */
export async function cropImageToBlob(
    src: string,
    rect: CropRect,
    quality = 0.9,
): Promise<Blob> {
    const img = await loadImage(src);
    const sx = rect.x * img.naturalWidth;
    const sy = rect.y * img.naturalHeight;
    const sw = rect.w * img.naturalWidth;
    const sh = rect.h * img.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 canvas 2D 上下文");

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("canvas.toBlob 返回 null"));
            },
            "image/webp",
            quality,
        );
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // 避免 canvas 污染
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
        img.src = src;
    });
}
```

- [ ] **Step 2: 类型检查**

Run: `make web-typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/features/upload/lib/crop-image.ts
git commit -m "feat(web): 新增 cropImageToBlob canvas 重编码工具

- 加载完整图 → canvas 按归一化选区裁剪 → WebP Blob
- 仅静态图用,GIF 走坐标路径不重编码
- drawImage 选区映射,支持 quality 参数"
```

---

## Task 8: `CropUploadDialog` 编排弹窗

**Files:**
- Create: `web/src/features/upload/ui/CropUploadDialog.tsx`

- [ ] **Step 1: 实现 CropUploadDialog**

Create `web/src/features/upload/ui/CropUploadDialog.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useChunkedUpload } from "@/features/upload/hooks/use-chunked-upload";
import { cropImageToBlob } from "@/features/upload/lib/crop-image";
import { withCrop, type CropRect } from "@/features/upload/lib/cropUrl";
import { useChunkedUpload as _useChunkedUpload } from "@/features/upload/hooks/use-chunked-upload";
import { Button } from "@shared/ui/base/button";
import { Modal } from "@shared/ui/modal";
import { ImageCropper } from "@shared/ui/image-cropper/ImageCropper";
import { toast } from "sonner";

export type CropUploadResult =
    | { kind: "static"; url: string }
    | { kind: "gif"; url: string };

export interface CropUploadDialogProps {
    /** 本地新选的文件(头像/素材库上传场景) */
    file?: File;
    /** 已有素材 URL(Cover 选择场景;静态图会重新上传为新素材) */
    srcUrl?: string;
    /** 选区宽高比;undefined 自由(素材库) */
    aspect?: number;
    /** 上传用途,透传 useChunkedUpload:avatar/cover/material */
    purpose: string;
    /** 上传后文件名(扩展名按 gif/webp 自动定) */
    fileNameBase?: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: (result: CropUploadResult) => void;
}

/**
 * CropUploadDialog - 选区上传编排弹窗。
 *
 * 单一职责:判定 GIF → GIF 存坐标(原图需先上传拿 URL)、
 * 静态图 canvas 重编码 → useChunkedUpload 上传。
 * 三处接入(AvatarUploader / 素材库 / Cover)复用。
 *
 * 依赖方向:features/upload → shared/ui(image-cropper/modal),合法。
 */
export function CropUploadDialog({
    file,
    srcUrl,
    aspect,
    purpose,
    fileNameBase = "cropped",
    open,
    onOpenChange,
    onConfirm,
}: CropUploadDialogProps) {
    const [rect, setRect] = useState<CropRect | undefined>(undefined);
    const [busy, setBusy] = useState(false);
    const { uploadFile } = useChunkedUpload({ purpose });

    // 预览源:优先本地文件 object URL,其次已有 srcUrl
    const previewSrc = useMemo(() => {
        if (file) return URL.createObjectURL(file);
        return srcUrl;
    }, [file, srcUrl]);

    // 释放 object URL
    useEffect(() => {
        return () => {
            if (file && previewSrc) URL.revokeObjectURL(previewSrc);
        };
    }, [file, previewSrc]);

    const isGif =
        file?.type === "image/gif" || srcUrl?.split("?")[0].toLowerCase().endsWith(".gif");

    const handleConfirm = useCallback(async () => {
        if (!rect) {
            toast.error("请先选定裁剪区域");
            return;
        }
        setBusy(true);
        try {
            if (isGif) {
                // GIF:上传原图(若本地文件)拿 URL,再拼坐标
                let url = srcUrl;
                if (file) {
                    const result = await uploadFile(file);
                    url = result.url;
                }
                if (!url) throw new Error("GIF 上传未返回 URL");
                onConfirm({ kind: "gif", url: withCrop(url, rect) });
            } else {
                // 静态图:canvas 重编码上传
                const blob = await cropImageToBlob(previewSrc, rect);
                const croppedFile = new File([blob], `${fileNameBase}.webp`, {
                    type: "image/webp",
                });
                const result = await uploadFile(croppedFile);
                onConfirm({ kind: "static", url: result.url });
            }
            onOpenChange(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "裁剪上传失败");
        } finally {
            setBusy(false);
        }
    }, [rect, isGif, file, srcUrl, previewSrc, fileNameBase, uploadFile, onConfirm, onOpenChange]);

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={isGif ? "选区(GIF 保留动画)" : "裁剪上传"}
            size="md"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                        取消
                    </Button>
                    <Button onClick={handleConfirm} disabled={busy || !rect}>
                        {busy ? "处理中..." : "确认"}
                    </Button>
                </div>
            }
        >
            {previewSrc ? (
                <ImageCropper src={previewSrc} aspect={aspect} onChange={setRect} />
            ) : (
                <p className="text-sm text-muted-foreground">无可用图片源</p>
            )}
        </Modal>
    );
}
```

> 注:`useChunkedUpload` import 写了重复行(Step 1 代码里有笔误占位),**实现时只保留一行 `import { useChunkedUpload } from "@/features/upload/hooks/use-chunked-upload";`,删掉 `_useChunkedUpload` 那行。** 这是计划文档的笔误,照此修正即可。

- [ ] **Step 2: 类型检查 + lint**

Run: `make web-typecheck && make web-lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/features/upload/ui/CropUploadDialog.tsx
git commit -m "feat(web): 新增 CropUploadDialog 裁剪上传弹窗

- 编排 GIF 判定 + 静态图重编码 + 分片上传
- GIF 上传原图后拼 ?crop= 坐标,保留动画
- 静态图 canvas 重编码 WebP 上传,真裁剪
- 复用 ImageCropper + Modal + useChunkedUpload"
```

---

## Task 9: AvatarUploader 接入选区上传

**Files:**
- Modify: `web/src/features/upload/ui/AvatarUploader.tsx`

- [ ] **Step 1: 改 AvatarUploader**

Replace the entire content of `web/src/features/upload/ui/AvatarUploader.tsx`:

```tsx
import { useState } from "react";
import type { UserDTO } from "@/entities/user/model/types";
import { useUpdateProfile } from "@/features/auth/api/mutations";
import { avatarUrl } from "../lib/imageUrl";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { CropUploadDialog, type CropUploadResult } from "./CropUploadDialog";

interface AvatarUploaderProps {
    user: UserDTO;
}

/**
 * AvatarUploader - 头像上传组件。
 *
 * 流程:选图 → 弹裁剪选区 → 确认后上传(GIF 存坐标、静态图重编码)
 * → 更新个人资料。显示层用 CroppedImage 处理 ?crop= 视觉裁剪。
 */
export function AvatarUploader({ user }: AvatarUploaderProps) {
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [cropOpen, setCropOpen] = useState(false);
    const [error, setError] = useState("");
    const updateProfile = useUpdateProfile();

    const handleConfirm = async (result: CropUploadResult) => {
        setError("");
        try {
            await updateProfile.mutateAsync({ avatar_url: result.url });
        } catch (e) {
            setError(e instanceof Error ? e.message : "更新头像失败");
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <CroppedImage
                src={avatarUrl(user.avatar_url, user.username)}
                aspect={1}
                className="h-24 w-24 rounded-full"
                alt={`${user.username} 的头像`}
            />
            <label className="cursor-pointer text-sm text-blue-600 hover:underline">
                {updateProfile.isPending ? "保存中..." : "更换头像"}
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    disabled={updateProfile.isPending}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                            setPendingFile(f);
                            setCropOpen(true);
                        }
                        e.target.value = "";
                    }}
                />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <CropUploadDialog
                file={pendingFile ?? undefined}
                aspect={1}
                purpose="avatar"
                fileNameBase="avatar"
                open={cropOpen}
                onOpenChange={setCropOpen}
                onConfirm={handleConfirm}
            />
        </div>
    );
}
```

- [ ] **Step 2: 类型检查 + lint**

Run: `make web-typecheck && make web-lint`
Expected: PASS

> 注:原 `AvatarUploader` 直接调 `initUpload/uploadChunk/completeUpload`,现在改走 `CropUploadDialog` 内部 `useChunkedUpload`,原裸函数 import 全删。`sha256` import 也删。

- [ ] **Step 3: Commit**

```bash
git add web/src/features/upload/ui/AvatarUploader.tsx
git commit -m "feat(web): AvatarUploader 接入选区上传

- 选图后弹 CropUploadDialog 选区,确认才上传
- 显示层换 CroppedImage,支持 ?crop= 视觉裁剪
- 删除手写的 initUpload/uploadChunk/completeUpload 调用
- 复用 CropUploadDialog 内的 useChunkedUpload"
```

---

## Task 10: 素材库上传单图支持裁剪

**Files:**
- Modify: `web/src/routes/admin.media.tsx`(上传 Modal 区域,line 234-257 附近)

- [ ] **Step 1: 读当前上传 Modal 上下文**

Run: `cd web && sed -n '200,260p' src/routes/admin.media.tsx`
确认 `uploadOpen` state、`queryClient`、`adminMediaKeys` 引用。

- [ ] **Step 2: 新增图片裁剪入口**

在 `admin.media.tsx` 顶部 import 区加:

```ts
import { CropUploadDialog } from "@features/upload/ui/CropUploadDialog";
```

在组件内(已有 `uploadOpen` state 附近)加:

```ts
const [imageCropFile, setImageCropFile] = useState<File | null>(null);
const [imageCropOpen, setImageCropOpen] = useState(false);
```

在上传 Modal(`title="上传素材"`)上方加一个「上传图片(裁剪)」按钮:

```tsx
<Button
    type="button"
    variant="outline"
    onClick={() => imageInputRef.current?.click()}
>
    上传图片(裁剪)
    <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
                setImageCropFile(f);
                setImageCropOpen(true);
            }
            e.target.value = "";
        }}
    />
</Button>
```

需要 `const imageInputRef = useRef<HTMLInputElement>(null);` 与 `import { useRef } from "react";`(若未引入)。

- [ ] **Step 3: 在 Modal 末尾挂 CropUploadDialog**

在编辑弹窗等 Modal 同级处加:

```tsx
<CropUploadDialog
    file={imageCropFile ?? undefined}
    aspect={undefined}
    purpose="material"
    fileNameBase={imageCropFile?.name.replace(/\.[^.]+$/, "") ?? "material"}
    open={imageCropOpen}
    onOpenChange={setImageCropOpen}
    onConfirm={() => {
        queryClient.invalidateQueries({ queryKey: adminMediaKeys.lists() });
    }}
/>
```

- [ ] **Step 4: 类型检查 + lint**

Run: `make web-typecheck && make web-lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/admin.media.tsx
git commit -m "feat(web): 素材库上传单图支持裁剪

- 新增「上传图片(裁剪)」入口,图片走 CropUploadDialog
- 原多文件拖拽 Modal 保留,服务非图片类型
- 上传成功后刷新素材列表"
```

---

## Task 11: Cover 选区裁剪接入

**Files:**
- Modify: `web/src/features/admin-media/ui/Cover.tsx`

- [ ] **Step 1: 改 Cover**

Replace `web/src/features/admin-media/ui/Cover.tsx`:

```tsx
/**
 * Cover - 封面图选择器
 *
 * 封装「从素材库选择 + 选区裁剪」完整交互:选完素材后进裁剪弹窗,
 * 静态图重编码上传为新素材(purpose=cover),GIF 存坐标回填。
 * 已选时显示 CroppedImage 预览与更换/移除操作。
 */

import type { MediaFile, MediaType } from "@entities/media/model/types";
import { MediaPicker } from "@features/admin-media/ui/MediaPicker";
import {
    CropUploadDialog,
    type CropUploadResult,
} from "@features/upload/ui/CropUploadDialog";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { Button } from "@shared/ui/base/button";
import { ImagePlus } from "lucide-react";
import { useState } from "react";

export interface CoverProps {
    id?: string;
    value: string | undefined | null;
    onChange: (url: string) => void;
    onClear?: () => void;
    title?: string;
    mediaType?: MediaType;
}

export function Cover({
    id,
    value,
    onChange,
    onClear,
    title = "选择封面图",
    mediaType = "image",
}: CoverProps) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [cropSrc, setCropSrc] = useState<string | undefined>(undefined);

    const handlePick = (files: MediaFile[]) => {
        if (files[0]) {
            setCropSrc(files[0].url);
        }
    };

    const handleCropConfirm = (result: CropUploadResult) => {
        onChange(result.url);
        setCropSrc(undefined);
    };

    return (
        <div id={id} className="space-y-1.5">
            {value ? (
                <div className="group relative overflow-hidden rounded-lg border border-edge-hairline">
                    <CroppedImage src={value} aspect={16 / 9} className="w-full" alt="封面" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-linear-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => setPickerOpen(true)}
                        >
                            更换
                        </Button>
                        {onClear ? (
                            <Button type="button" variant="secondary" size="xs" onClick={onClear}>
                                移除
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-edge-hairline text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                    <ImagePlus className="size-5" />
                    选择封面图
                </button>
            )}
            <MediaPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                mediaType={mediaType}
                title={title}
                onConfirm={handlePick}
            />
            <CropUploadDialog
                srcUrl={cropSrc}
                aspect={16 / 9}
                purpose="cover"
                fileNameBase="cover"
                open={!!cropSrc}
                onOpenChange={(v) => {
                    if (!v) setCropSrc(undefined);
                }}
                onConfirm={handleCropConfirm}
            />
        </div>
    );
}
```

- [ ] **Step 2: 类型检查 + lint**

Run: `make web-typecheck && make web-lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/features/admin-media/ui/Cover.tsx
git commit -m "feat(web): Cover 选完素材进裁剪弹窗

- MediaPicker 单选确认后开 CropUploadDialog 选区
- 静态图重编码上传为新素材(purpose=cover),GIF 存坐标
- 预览区换 CroppedImage,支持 ?crop= 视觉裁剪"
```

---

## Task 12: 全量验证 + 收尾

- [ ] **Step 1: 全量测试**

Run: `make web-test`
Expected: PASS(含新增 cropUrl / crop-to-style / imageUrl 测试)

- [ ] **Step 2: 全量类型检查**

Run: `make web-typecheck`
Expected: PASS

- [ ] **Step 3: lint + format**

Run: `make web-lint && make web-format`
Expected: PASS

- [ ] **Step 4: 手动验证清单(若环境允许)**

启动 `make dev`,在浏览器验证:
1. 个人中心 → 更换头像 → 选静态图 → 裁剪确认 → 头像更新,无 `?crop`(重编码上传)
2. 个人中心 → 更换头像 → 选 GIF → 裁剪确认 → 头像 URL 含 `?crop=`,动画保留(注意 `avatarUrl` 对 GIF 已剥 format=webp)
3. 素材库 → 上传图片(裁剪) → 选图裁剪 → 素材列表刷新出现新图
4. 文章编辑器 → 封面图 → 选择 → 选素材 → 裁剪确认 → 封面回填;GIF 封面动画保留
5. 已有 `?crop=` 的封面在 PostCard/blog 详情正确聚焦(若 Task 11 外的渲染点未替换 `<img>`,记录为后续 follow-up)

- [ ] **Step 5: 最终状态确认**

Run: `git status && git log --oneline -12`
Expected: 工作区干净,12 个 commit 按计划顺序排列

---

## Self-Review

**Spec 覆盖:**
- Section 3.1 cropUrl → Task 2 ✅
- Section 3.2 ImageCropper → Task 4 ✅;CroppedImage → Task 5 ✅;cropToStyle → Task 3 ✅
- Section 3.3 CropUploadDialog → Task 8 ✅;cropImageToBlob → Task 7 ✅
- Section 3.4 AvatarUploader → Task 9 ✅;素材库 → Task 10 ✅;Cover → Task 11 ✅
- Section 3.4 GIF 动画保护(avatarUrl 特判)→ Task 6 ✅
- Section 5 提交拆分(8 commit)→ 本计划 12 commit(更细:拆出 cropToStyle/crop-image/imageUrl 测试独立提),符合原子性 ✅
- Section 3.5 显示层全景:AvatarUploader(Task 9)、Cover(Task 11)已接 CroppedImage;**PostCard / blog /$slug / AnnouncementCard 等外部 `cover_url` 渲染点未替换**——这是 follow-up,记录在 Task 12 Step 4 第 5 条

**Placeholder 扫描:**
- Task 8 Step 1 标注了一处 `useChunkedUpload` 重复 import 笔误,已明确给出修正指令(非 TBD)
- Task 4 注释里的 `objectFit` 取值给了实现时按文档调的余地,但代码本身完整可编译
- 无 TBD/TODO/"similar to"/未定义引用

**类型一致性:**
- `CropRect` 全程 `{x,y,w,h}`(Task 2 定义,Task 3/4/7/8 一致使用)✅
- `CropUploadResult` 在 Task 8 定义,Task 9/11 消费,kind/url 字段一致 ✅
- `CropUploadDialogProps` 字段(file/srcUrl/aspect/purpose/fileNameBase/open/onOpenChange/onConfirm)在 Task 8/9/10/11 一致 ✅

**已知 follow-up(不在本计划范围):**
1. PostCard / blog /$slug / AnnouncementCard 等外部 `cover_image` 渲染点替换为 `CroppedImage`(支持 GIF 封面动画 + 视觉裁剪聚焦)
2. GIF 头像在各评论列表(CommentItem/AnnotationCard/AvatarGroup)的渲染是否需要同步保护动画
