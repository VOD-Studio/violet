import type { Charset, Pose } from "./types";

export interface Region {
  /** 1 起始的行、列。 */
  row: number;
  col: number;
  width: number;
  height: number;
}

export interface MountOptions {
  stream?: { isTTY?: boolean; columns?: number; rows?: number; write(s: string): unknown };
  region: Region;
  pet: { species: number; genes: number[] };
  getPose?: () => Pose;
  charset?: Charset;
}

export function mountTerminalPet(options: MountOptions): { dispose(): void };
