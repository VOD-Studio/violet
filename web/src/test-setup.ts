/**
 * Vitest 全局 setup
 *
 * 注册 @testing-library/jest-dom 自定义匹配器（toBeInTheDocument 等），
 * 让所有测试文件无需单独 import。
 */
import "@testing-library/jest-dom/vitest";

// mock window.matchMedia（jsdom 不支持，theme store 在导入时访问）
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// mock localStorage（zustand persist 需要）
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });
