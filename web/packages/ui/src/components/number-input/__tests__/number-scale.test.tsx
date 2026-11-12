import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { NumberInput } from "../number-input";

const field = () => screen.getByRole<HTMLInputElement>("spinbutton", { name: "精细步长" });

describe("NumberInput 数值初值与草稿格式", () => {
	it("指数表示的小数型默认值按步长精度显示，失焦不清掉合法值", () => {
		const commit = vi.fn();
		render(
			<NumberInput
				aria-label="精细步长"
				defaultValue={0.0000001}
				step={0.0000001}
				onValueCommit={commit}
			/>,
		);
		expect(field().value).toBe("0.0000001");
		fireEvent.focus(field());
		fireEvent.blur(field());
		expect(field().value).toBe("0.0000001");
		expect(commit).not.toHaveBeenCalled();
		fireEvent.keyDown(field(), { key: "ArrowUp" });
		expect(field().value).toBe("0.0000002");
		expect(commit).toHaveBeenCalledExactlyOnceWith(0.0000002);
	});

	it("外部数值更新不被当成非法指数草稿，受控步进保持精度", () => {
		const commit = vi.fn();
		function Controlled() {
			const [value, setValue] = useState(0);
			return (
				<>
					<NumberInput
						aria-label="精细步长"
						value={value}
						step={0.0000001}
						onChange={(event) => setValue(Number(event.currentTarget.value))}
						onValueCommit={commit}
					/>
					<button type="button" onClick={() => setValue(0.0000001)}>
						应用外部值
					</button>
				</>
			);
		}
		render(<Controlled />);
		fireEvent.click(screen.getByRole("button", { name: "应用外部值" }));
		expect(field().value).toBe("0.0000001");
		fireEvent.blur(field());
		expect(field().value).toBe("0.0000001");
		expect(commit).not.toHaveBeenCalled();
		fireEvent.keyDown(field(), { key: "ArrowUp" });
		expect(field().value).toBe("0.0000002");
		expect(commit).toHaveBeenCalledExactlyOnceWith(0.0000002);
	});
});
