/**
 * 表情体系类型契约 —— types/ 目录入口。
 *
 * - ./animation:波形原语(Anim 族)
 * - ./pose:静态姿态层(BodyPose/EyePose 族 + 关键帧)
 * - ./emotion:表情定义(EmotionDef)
 *
 * 38 套表情数据(#00-#37)见 ../emotions.ts,配色资产见 ../palette.ts。
 */
export type * from "./animation";
export type * from "./emotion";
export type * from "./pose";
