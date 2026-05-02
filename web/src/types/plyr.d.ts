import "plyr-react";

declare module "plyr-react" {
  import { ComponentType } from "react";

  export interface PlyrSource {
    type: string;
    sources: Array<{
      src: string;
      type?: string;
      provider?: string;
      size?: number;
    }>;
  }

  export interface PlyrOptions {
    controls?: string[];
    settings?: string[];
    i18n?: Record<string, string>;
    loadSprite?: boolean;
    iconUrl?: string;
    iconPrefix?: string;
    blankVideo?: string;
    debug?: boolean;
    autopause?: boolean;
    seekTime?: number;
    volume?: number;
    muted?: boolean;
    clickToPlay?: boolean;
    disableContextMenu?: boolean;
    hideControls?: boolean;
    resetOnEnd?: boolean;
    keyboard?: boolean | { focused: boolean; global: boolean };
    tooltips?: { controls: boolean; seek: boolean };
    duration?: number;
    displayDuration?: boolean;
    invertTime?: boolean;
    toggleInvert?: boolean;
    listeners?: Record<string, () => void>;
    ratio?: string;
    storage?: { enabled: boolean; key: string };
    speed?: { selected: number; options: number[] };
    quality?: {
      default: number;
      options: number[];
      forced?: boolean;
      onChange?: (quality: number) => void;
    };
    loop?: { active: boolean };
    ads?: { enabled: boolean; publisherId: string };
    captions?: {
      active?: boolean;
      update?: boolean;
      language?: string;
    };
    fullscreen?: {
      enabled?: boolean;
      fallback?: boolean;
      iosNative?: boolean;
    };
    previewThumbnails?: { enabled: boolean; src: string };
    vimeo?: {
      byline?: boolean;
      portrait?: boolean;
      title?: boolean;
      speed?: boolean;
      sid?: string;
      transparent?: boolean;
      customControls?: boolean;
      referrerPolicy?: string;
      premium?: boolean;
    };
    youtube?: {
      noCookie?: boolean;
      rel?: number;
      showinfo?: number;
      iv_load_policy?: number;
      modestbranding?: number;
      customControls?: boolean;
    };
  }

  export interface PlyrInstance {
    play(): Promise<void>;
    pause(): void;
    stop(): void;
    restart(): void;
    rewind(seekTime?: number): void;
    forward(seekTime?: number): void;
    seek(seekTime: number): void;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
    playing: boolean;
    paused: boolean;
    stopped: boolean;
    ended: boolean;
    source: PlyrSource | null;
    poster: string;
    autoplay: boolean;
    currentTrack: number;
    tracks: Array<{
      language: string;
      kind: string;
      label: string;
      default?: boolean;
      src: string;
    }>;
    quality: string | null;
    speed: number;
    loop: boolean;
    on(event: string, callback: () => void): void;
    once(event: string, callback: () => void): void;
    off(event: string, callback?: () => void): void;
    destroy(): void;
    elements: {
      container: HTMLElement;
      buttons: {
        play: HTMLElement[];
      };
    };
  }

  export interface APITypes {
    type: string;
    provider: string;
  }

  export type Plyr = PlyrInstance;

  export interface PlyrProps {
    source?: PlyrSource;
    options?: PlyrOptions;
    ref?: React.Ref<PlyrInstance>;
  }

  export interface PlyrComponentProps {
    source?: PlyrSource;
    options?: PlyrOptions;
    ref?: React.Ref<PlyrInstance>;
  }

  export const Plyr: ComponentType<PlyrComponentProps>;
  export default Plyr;
}