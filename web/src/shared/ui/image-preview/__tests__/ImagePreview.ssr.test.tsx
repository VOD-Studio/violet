import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

// @vitest-environment node

describe("ImagePreview SSR 安全", () => {
    it("open=false 时不应访问 document", () => {
        expect(() =>
            renderToString(
                <ImagePreview
                    open={false}
                    onClose={() => {}}
                    images={[]}
                    thumbnails={[]}
                    currentIndex={0}
                />,
            ),
        ).not.toThrow();
    });

    it("open=true 且含图片时不应访问 document", () => {
        expect(() =>
            renderToString(
                <ImagePreview
                    open
                    onClose={() => {}}
                    images={["/img1.jpg", "/img2.jpg"]}
                    thumbnails={["/thumb1.jpg", "/thumb2.jpg"]}
                    currentIndex={0}
                />,
            ),
        ).not.toThrow();
    });
});
