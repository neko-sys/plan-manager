import { motion } from "motion/react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

type TimerControlsProps = {
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
};

export function TimerControls({
  isRunning,
  isPaused,
  onStart,
  onPause,
  onResume,
  onReset,
  onSkip,
}: TimerControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center gap-3"
    >
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          variant="outline"
          size="icon"
          onClick={onReset}
          className="h-11 w-11 rounded-full border-muted-foreground/20 hover:bg-muted/50"
          title="重置"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          size="lg"
          onClick={() => {
            if (isRunning) {
              onPause();
            } else if (isPaused) {
              onResume();
            } else {
              onStart();
            }
          }}
          className="h-16 w-16 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl"
          style={{
            background: isRunning
              ? "linear-gradient(135deg, oklch(0.65 0.22 25) 0%, oklch(0.70 0.20 35) 100%)"
              : "linear-gradient(135deg, oklch(0.70 0.18 150) 0%, oklch(0.75 0.16 160) 100%)",
          }}
        >
          {isRunning ? (
            <Pause className="h-6 w-6 text-white" />
          ) : (
            <Play className="h-6 w-6 text-white ml-0.5" />
          )}
        </Button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          variant="outline"
          size="icon"
          onClick={onSkip}
          className="h-11 w-11 rounded-full border-muted-foreground/20 hover:bg-muted/50"
          title="跳过"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
