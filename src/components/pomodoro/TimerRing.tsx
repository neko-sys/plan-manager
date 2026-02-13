import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { TimerPhase } from "@/domain/pomodoro";
import { calculateProgress, formatTime, PHASE_COLORS } from "@/domain/pomodoro";

type TimerRingProps = {
  remainingSeconds: number;
  totalSeconds: number;
  phase: TimerPhase;
  isRunning: boolean;
};

const RING_SIZE = 280;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TimerRing({ remainingSeconds, totalSeconds, phase, isRunning }: TimerRingProps) {
  const progress = calculateProgress(remainingSeconds, totalSeconds);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const colors = PHASE_COLORS[phase];
  const timeDisplay = formatTime(remainingSeconds);
  const prevRunningRef = useRef(isRunning);

  useEffect(() => {
    prevRunningRef.current = isRunning;
  }, [isRunning]);

  const pulseAnimation = isRunning
    ? {
        scale: [1, 1.02, 1],
        transition: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      }
    : {};

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        animate={pulseAnimation}
        className="relative"
        style={{ width: RING_SIZE, height: RING_SIZE }}
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          className="transform -rotate-90"
        >
          <defs>
            <linearGradient id={`gradient-${phase}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.primary} />
              <stop offset="100%" stopColor={colors.secondary} />
            </linearGradient>
            <filter id={`glow-${phase}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className="text-muted/20"
          />

          <motion.circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={`url(#gradient-${phase})`}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            filter={`url(#glow-${phase})`}
            initial={false}
            animate={{
              strokeDashoffset,
            }}
            transition={{
              duration: 0.5,
              ease: "linear",
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={timeDisplay}
            initial={{ opacity: 0.8, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.1 }}
            className="font-mono text-5xl font-light tracking-tight"
            style={{
              fontVariantNumeric: "tabular-nums",
              color: colors.primary,
            }}
          >
            {timeDisplay}
          </motion.span>

          {isRunning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2 flex items-center gap-1.5"
            >
              <motion.span
                animate={{
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: colors.primary }}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {phase === "work" ? "专注中" : phase === "shortBreak" ? "休息中" : "长休息"}
              </span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${colors.primary}08 0%, transparent 70%)`,
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  );
}
