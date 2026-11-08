# 验证码

`InputOTP` 将整串验证码映射到六个可见、独立可聚焦的原生 `input`。不依赖 `input-otp`，不使用隐藏的交互输入、假光标或固定验证码校验。请求、验证码是否正确以及反馈文案由调用方负责。

## 组合与受控值

```tsx
import { Field, InputOTP, InputOTPGroup, InputOTPSlot } from "@violet/ui";

<Field label="邮箱验证码" hint="请输入邮件里的六位数字" error={error} success={verified ? "验证通过" : undefined}>
  <InputOTP
    name="code"
    value={code}
    onChange={setCode}
    onComplete={verifyCode}
    invalid={Boolean(error)}
    valid={verified}
    disabled={isVerifying}
  >
    <InputOTPGroup>
      {Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} />)}
    </InputOTPGroup>
  </InputOTP>
</Field>
```

不需要自定义分组或单格属性时可省略 children，根会生成全部输入格。`maxLength` 默认 6，指定其他正整数时同步决定格数；组合形式必须提供对应的所有索引。

- `value` / `defaultValue` 是整串数字；非数字被过滤，超过 `maxLength` 的部分被截断。
- `onChange(value)` 请求更新整串，`onComplete(value)` 只在用户输入、粘贴或短信自动填使所有格子填满时调用。初值、受控 prop 更新、reset 和错误清空不触发完成；原样重复输入同一码不重复完成。
- 受控模式以父层确认的值为准，不提前接受被拒绝的输入。父层同步回写 `onChange` 的值时保留被删除格子的空位，不将后续数字向前挤；拒绝输入或由外部替换为其他值后，旧空位不再参与后续更新。`onChange` 的字符串只包含实际数字；完成判定仍检查每个格子而非字符串长度。
- 清空受控值用 `value=""`。不要同时在 `onChange` 检查满位提交、又在 `onComplete` 提交，以免重复请求。

## 原生属性与表单

| 属性 | 归属与行为 |
| --- | --- |
| 根 `ref`、`id` | 第一格真实 input；可 `focus()` / `select()`，Field 的 label 点击目标也是第一格 |
| 根 `className`、`containerClassName` | 整组容器；单格 className/style/ref 放在 `InputOTPSlot` |
| 根原生输入事件、style、required、form | 传给每个真实 input；`autoFocus` 只传首格；各位还可设置自己的原生属性 |
| 根 `aria-label` / `aria-labelledby` | 命名整组，不覆盖各位名称 |
| `aria-describedby` / `aria-invalid` | 接线到整组和每一格；Field 内自动接入标签与消息行 |
| `name` | 一枚非交互 hidden input 序列化整串，不重复提交各位数字；不传 name 时只渲染六枚 input |
| `disabled` | 六格原生禁用，整串不参与 FormData |
| `readOnly` | 六格可聚焦、选择、复制，不能输入、粘贴或删除；左右导航保留，值照常提交 |

非受控原生 `form.reset()` 恢复挂载初值并通知 `onChange`；受控 reset 请求挂载时的值，由宿主确认。被 `preventDefault()` 取消的 reset 不改值。外部 `form` 属性及独立 DOM / ShadowRoot 的原生 reset 同样接入。根 ref 与标签落到首格，原生 required 则逐格检查，浏览器可聚焦第一个未填的格子。

根和单格的键盘、粘贴与聚焦 handler 都先交给调用方；`preventDefault()` 会取消组件的后续行为。单格原生 `onChange` 也可取消值更新。

## 键盘、自动填与读屏

- 每格默认名称「第 1 位」至「第 6 位」，整组默认名称「6 位验证码」；置于 Field 时整组取 Field 标签。
- 默认 `inputMode="numeric"`、`autoComplete="one-time-code"`，每格允许浏览器交付整串自动填事件，再由根拆分，不用 `maxLength=1` 提前截掉短信内容。
- 输入数字覆盖当前格并直接聚焦下一格；最后一格停留，不播放跳格动画。
- Backspace 清空当前位并回前位；当前位为空时同时清除前一位。Delete 只清当前位。
- ← / → 在格子之间移动并选择对应数字，到边缘停止；Tab 使用真实 input 的原生顺序。
- 完整验证码可粘到任意格，从第一格覆盖全串；短串从当前格开始覆盖。过滤空格、连字符及其他非数字内容。短信建议填入第一格的整串 change 与此使用同一拆分行为。
- 组件不创建内部 `aria-live` 或提示文案。验证中、错误和通过说明使用 Field 的 `checking`、`error`、`success`，其消息行负责读出。

## 视觉与状态

唯一外观在 `otp.css`：每格 44×52、圆角 10、间隔 8，第三格后再加 8；等宽数字 22 / 500，系统等宽字体随宿主 `--font-mono` 覆盖。

`invalid` 优先于 `aria-invalid`；`aria-invalid="grammar"` / `"spelling"` 也按错误处理。错误上升沿让所有格子换危险环并播放一次 500ms 涟漪，期间暂时只读，结束后请求清空并聚焦首格。错误状态本身继续由调用方持有，输入新值时应撤销旧错误；保持同一次 invalid 不会不断清空。撤销 invalid、禁用、只读、未取消的原生 reset 或卸载会取消待执行清空；解除禁用 / 只读不会重播仍保持的旧错误。减弱动态不播涟漪，直接清空并聚焦。

`valid` 只改成功环，不宣称验证码正确、不发起验证、不输出消息。readonly 使用中性只读外观。焦点环在格子外扩 4px，宿主裁剪层必须留足空间。

普通 CSS 消费先加载 `@violet/ui/tokens.css`，再加载 `@violet/ui/components/otp.css`；React 与纯 HTML 使用同一组 `.v-otp` / `.v-otp__group` / `.v-otp__cell` / `.v-otp__input` 规则。

相关重发行为见 [ResendButton](./resend-button.md)。行为测试位于单元 `__tests__/`；展品 `otp` 只在展品内部模拟校验与发送，库本身没有模拟后端。
