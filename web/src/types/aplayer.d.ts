declare module "aplayer" {
  interface APlayerAudio {
    name: string;
    artist: string;
    url: string;
    cover?: string;
    lrc?: string;
    theme?: string;
  }

  interface APlayerOptions {
    container: HTMLElement;
    fixed?: boolean;
    mini?: boolean;
    autoplay?: boolean;
    mutex?: boolean;
    lrcType?: number;
    order?: "random" | "list";
    preload?: "auto" | "metadata" | "none";
    volume?: number;
    audio: APlayerAudio[];
    listFolded?: boolean;
    listMaxHeight?: string;
    storageName?: string;
    theme?: string;
  }

  class APlayer {
    constructor(options: APlayerOptions);
    play(): void;
    pause(): void;
    seek(time: number): void;
    volume(percentage: number, nostorage?: boolean): void;
    skipForward(): void;
    skipBack(): void;
    destroy(): void;
    on(event: string, callback: () => void): void;
    notice(text: string, time?: number): void;
    addAudio(audio: APlayerAudio): void;
    removeAudio(index: number): void;
    switchAudio(index: number): void;
  }

  namespace APlayer {
    type Audio = APlayerAudio;
    type Options = APlayerOptions;
  }

  export = APlayer;
}

declare module "meting" {
  interface MetingOptions {
    api?: string;
    server: "netease" | "tencent" | "kugou" | "baidu";
    type: "playlist" | "song" | "album" | "artist" | "search";
    id: string;
  }

  class Meting {
    constructor(options: MetingOptions);
    getData(): Promise<any[]>;
  }

  export = Meting;
}