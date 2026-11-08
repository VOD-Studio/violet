# 重新发送

`ResendButton` 是独立的发送与冷却单元，组合真实 Button，包含自己的异步互斥、截止时间、resetKey 隔离和卸载清理。它不是 OTP 的重导出，也不发送任何请求或判断邮箱是否合法。

```tsx
import { ResendButton } from "@violet/ui";

<ResendButton
  resetKey={email}
  label={codeSent ? "重新发送" : "发送验证码"}
  disabled={isUnavailable}
  onResend={async () => {
    if (!email.trim()) return false;
    try {
      await sendCode(email);
      setCodeSent(true);
      return true;
    } catch (error) {
      showSendError(error);
      return false;
    }
  }}
/>
```

## 发送契约

| 结果 | 后续行为 |
| --- | --- |
| `false` 或 `Promise<false>` | 未成功发送，立即恢复可点击，不进入冷却 |
| `true`、`undefined`、`void` 或对应的成功 Promise | 完成后开始冷却 |
| 同步抛错或 Promise 拒绝 | 不进入冷却，解除 pending，交给 `onError(error)`；未提供 `onError` 时继续抛出原错误，不静默吞掉，也不在组件内生成错误文案 |
| Promise 未完成 | 显示 `pendingLabel`（默认「发送中…」），`aria-busy=true`，原生 disabled，并用同步锁拦住同批次双击 |

异步发送必须返回实际请求 Promise。仅调用 `mutation.mutate()` 然后返回 void 表示「同步完成」，按钮无法等待请求或识别失败；应该改用 `await mutation.mutateAsync()`。调用方自行提供状态消息的 `aria-live` / Field 接线。

需要统一处理发送异常时，直接返回请求 Promise 并提供 `onError`；也可像上例一样在业务回调中处理真实异常后返回 `false`。不要同时处理同一错误又重新抛出，避免重复提示。换邮箱或卸载后，失效请求的错误会按会话隔离规则丢弃。

`cooldownSeconds` 默认 60，从成功结果到达时起算，不从点击或请求开始时起算。剩余时间依据截止时间计算、向上取整；后台漏掉 tick 不会延长冷却。零秒表示成功后无需冷却，非正值不延长倒计时。

冷却期间显示「58 秒后可重新发送」，只有数字使用系统等宽字体与 tabular-nums。到零恢复 `label` 对应的文字按钮。默认 link 变体无底色；旧调用方的 `variant="outline"` 等真实 Button 变体继续可用，冷却内容统一退为不可点击的说明文字。

## 换邮箱与卸载

`resetKey` 变化立即取消当前冷却并恢复可发送。旧请求的 resolve、reject、finally 都不能启动新邮箱的冷却、发出旧错误或解除新请求的 pending。resetKey 不会取消真实网络请求；业务闭包中对旧邮箱的副作用仍须由业务层根据邮箱或请求标识隔离。

卸载清理计时器，并令所有在途回调失效。不将已卸载请求的错误交给调用方。

## 原生按钮

- `ref` 指向真实 `HTMLButtonElement`，透传原生按钮属性、className、style、form 和辅助技术属性。
- 始终 `type="button"`，不会提交所在表单。
- `disabled`、pending 和倒计时共同阻止交互；倒计时结束不会覆盖调用方自己的 disabled。
- `onClick` 先执行；`preventDefault()` 取消发送。
- `label` 默认「重新发送」，`pendingLabel` 默认「发送中…」；两者都不包含固定验证码或请求实现。

唯一 BEM CSS 入口为 `@violet/ui/components/resend-button.css`，内部包含真实 Button CSS；普通 CSS 消费先导入 `@violet/ui/tokens.css`。`.v-resend-button` 控制发送与冷却的文字外观，`.v-resend-button__seconds` 只控制等宽数字。

行为测试覆盖成功后的时间边界、false / 拒绝、同步连点、pending、resetKey 旧结果、原生事件取消以及卸载。`otp` 展品提供可操作发送、冷却和失败状态，模拟请求仅位于展品，不进入库。
