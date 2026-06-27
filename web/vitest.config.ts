import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: false,
        include: ["src/**/*.test.{ts,tsx}"],
    },
    resolve: {
        alias: {
            "#": resolve(__dirname, "src"),
            "@": resolve(__dirname, "src"),
            "@shared": resolve(__dirname, "src/shared"),
            "@features": resolve(__dirname, "src/features"),
            "@widgets": resolve(__dirname, "src/widgets"),
            "@ui": resolve(__dirname, "src/shared/ui"),
            "@lib": resolve(__dirname, "src/shared/lib"),
            "@config": resolve(__dirname, "src/shared/config"),
            "@vendor/react-bits": resolve(__dirname, "src/shared/vendor/react-bits"),
        },
    },
});
