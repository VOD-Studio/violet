import json, subprocess, sys
# 生成场景:每步的 pet 来自上一步原生输出,所以这里只产出"命令模板",由 run 脚本串联。
steps = [
  ("act", {"action":"feed","now":"10","request_id":"a1"}),
  ("act", {"action":"feed","now":"10","request_id":"a1"}),   # 重放
  ("act", {"action":"play","now":"30","request_id":"a2"}),
  ("act", {"action":"play","now":"31","request_id":"a3"}),   # 再玩 (精力够)
  ("act", {"action":"heal","now":"40","request_id":"a4"}),   # 未生病
  ("act", {"action":"wait","now":"700","request_id":"a5"}),  # 失养 → 预警
  ("act", {"action":"wait","now":"800","request_id":"a6"}),  # 生病
  ("act", {"action":"heal","now":"801","request_id":"a7"}),  # 治疗
  ("act", {"action":"wait","now":"9000000000000000000","request_id":"a8"}),  # 超大 u64,休眠回归
  ("act", {"action":"heal","now":"9000000000000000001","request_id":"a9"}),
  ("act", {"action":"wait","now":"5","request_id":"a10"}), # 时间倒退
]
json.dump(steps, open("scenario/steps.json","w"), indent=1)
