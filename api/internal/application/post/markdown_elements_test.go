package post

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractMarkdownElements_Formulas(t *testing.T) {
	t.Run("inline 与 block 公式", func(t *testing.T) {
		md := "质能方程 $E=mc^2$ 是著名公式。\n\n$$\n\\int_0^1 x^2 \\, dx = \\frac{1}{3}\n$$\n"
		formulas, blocks := ExtractMarkdownElements(md)
		require.Empty(t, blocks)
		require.Len(t, formulas, 2)
		assert.Equal(t, "E=mc^2", formulas[0].Latex)
		assert.Equal(t, "inline", formulas[0].DisplayMode())
		assert.Equal(t, "\\int_0^1 x^2 \\, dx = \\frac{1}{3}", formulas[1].Latex)
		assert.Equal(t, "block", formulas[1].DisplayMode())
	})

	t.Run("嵌套与相邻美元符", func(t *testing.T) {
		md := "$a + b$ 和 $$x$$ 相邻，再来 $c$。"
		formulas, _ := ExtractMarkdownElements(md)
		require.Len(t, formulas, 3)
		assert.Equal(t, "a + b", formulas[0].Latex)
		assert.Equal(t, "x", formulas[1].Latex)
		assert.True(t, formulas[1].Block)
		assert.Equal(t, "c", formulas[2].Latex)
	})

	t.Run("转义美元符不识别", func(t *testing.T) {
		md := "价格是 \\$100，不是公式。真公式 $x$。"
		formulas, _ := ExtractMarkdownElements(md)
		require.Len(t, formulas, 1)
		assert.Equal(t, "x", formulas[0].Latex)
	})

	t.Run("开美元符后空白不识别", func(t *testing.T) {
		md := "苹果 $ 5 美元，香蕉 $ 3 美元"
		formulas, _ := ExtractMarkdownElements(md)
		assert.Empty(t, formulas)
	})

	t.Run("inline 公式不跨行", func(t *testing.T) {
		md := "这里 $x\ny$ 跨行，不识别。"
		formulas, _ := ExtractMarkdownElements(md)
		assert.Empty(t, formulas)
	})

	t.Run("代码块内美元符不识别为公式", func(t *testing.T) {
		md := "```python\nprice = \"$5\"\nformula = \"$E=mc^2$\"\n```\n\n真公式 $y=2x$。"
		formulas, blocks := ExtractMarkdownElements(md)
		require.Len(t, blocks, 1)
		require.Len(t, formulas, 1)
		assert.Equal(t, "y=2x", formulas[0].Latex)
	})

	t.Run("行内 code span 内美元符不识别", func(t *testing.T) {
		md := "命令 `echo $HOME` 里的变量不是公式，但 $z$ 是。"
		formulas, _ := ExtractMarkdownElements(md)
		require.Len(t, formulas, 1)
		assert.Equal(t, "z", formulas[0].Latex)
	})

	t.Run("公式偏移可用于截取原文", func(t *testing.T) {
		md := "前文 $E=mc^2$ 后文"
		formulas, _ := ExtractMarkdownElements(md)
		require.Len(t, formulas, 1)
		assert.Equal(t, "$E=mc^2$", md[formulas[0].Start:formulas[0].End])
	})
}

func TestExtractMarkdownElements_CodeBlocks(t *testing.T) {
	t.Run("基础围栏与语言归一", func(t *testing.T) {
		md := "前文\n\n```js runnable\nconsole.log(1)\n```\n\n后文"
		_, blocks := ExtractMarkdownElements(md)
		require.Len(t, blocks, 1)
		assert.Equal(t, "node", blocks[0].Lang) // js 归一为 node
		assert.True(t, blocks[0].Runnable)
		assert.Equal(t, "console.log(1)", blocks[0].Code)
	})

	t.Run("run 别名与 overrides JSON", func(t *testing.T) {
		md := "```python run {\"timeout_secs\":10}\nprint(1)\n```"
		_, blocks := ExtractMarkdownElements(md)
		require.Len(t, blocks, 1)
		assert.Equal(t, "python", blocks[0].Lang)
		assert.True(t, blocks[0].Runnable)
	})

	t.Run("非 runnable 块", func(t *testing.T) {
		md := "```rust\nfn main() {}\n```"
		_, blocks := ExtractMarkdownElements(md)
		require.Len(t, blocks, 1)
		assert.Equal(t, "rust", blocks[0].Lang)
		assert.False(t, blocks[0].Runnable)
	})

	t.Run("代码块内反引号原样保留", func(t *testing.T) {
		md := "```markdown\n这是 `行内代码` 示例\n```"
		_, blocks := ExtractMarkdownElements(md)
		require.Len(t, blocks, 1)
		assert.Contains(t, blocks[0].Code, "`行内代码`")
	})

	t.Run("更长闭围栏与波浪围栏", func(t *testing.T) {
		md := "````go\n代码含 ``` 三反引号\n````\n\n~~~\n无语言块\n~~~"
		_, blocks := ExtractMarkdownElements(md)
		require.Len(t, blocks, 2)
		assert.Equal(t, "go", blocks[0].Lang)
		assert.Contains(t, blocks[0].Code, "```")
		assert.Equal(t, "无语言块", blocks[1].Code)
	})

	t.Run("未闭合围栏到 EOF", func(t *testing.T) {
		md := "```python\nprint(1)\nprint(2)"
		_, blocks := ExtractMarkdownElements(md)
		require.Len(t, blocks, 1)
		assert.Equal(t, "print(1)\nprint(2)", blocks[0].Code)
	})

	t.Run("数学块与代码块相邻", func(t *testing.T) {
		md := "$$\\frac{1}{2}$$\n```python runnable\nprint(1)\n```\n$e^{i\\pi}+1=0$"
		formulas, blocks := ExtractMarkdownElements(md)
		require.Len(t, blocks, 1)
		require.Len(t, formulas, 2)
		assert.True(t, formulas[0].Block)
		assert.Equal(t, "\\frac{1}{2}", formulas[0].Latex)
		assert.Equal(t, "e^{i\\pi}+1=0", formulas[1].Latex)
		assert.Equal(t, "python", blocks[0].Lang)
		assert.True(t, blocks[0].Runnable)
	})

	t.Run("代码块偏移可用于截取原文", func(t *testing.T) {
		md := "前文\n```python\nprint(1)\n```\n后文"
		_, blocks := ExtractMarkdownElements(md)
		require.Len(t, blocks, 1)
		assert.Equal(t, "```python\nprint(1)\n```\n", md[blocks[0].Start:blocks[0].End])
	})
}

func TestExtractMarkdownElements_Empty(t *testing.T) {
	formulas, blocks := ExtractMarkdownElements("纯文本，没有任何元素。")
	assert.Empty(t, formulas)
	assert.Empty(t, blocks)

	formulas, blocks = ExtractMarkdownElements("")
	assert.Empty(t, formulas)
	assert.Empty(t, blocks)
}
