/**
 * 进度条组件
 * 显示播放进度和时间，支持拖动跳转
 */

interface PlayerProgressProps {
  currentTime: number;
  duration: number;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function PlayerProgress({
  currentTime,
  duration,
  onSeek,
}: PlayerProgressProps) {
  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="px-4 pt-3 pb-1 shrink-0">
      <input
        type="range"
        min="0"
        max={duration || 100}
        value={currentTime}
        onChange={onSeek}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
