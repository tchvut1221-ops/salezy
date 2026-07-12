import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  CircleAlert,
  Lightbulb,
  Zap,
  Clock,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Target,
  MessageCircle,
  HeartHandshake,
  LineChart,
  type LucideIcon,
} from "lucide-react";
import type {
  MomentType,
  NextStepPriority,
  ObjectionScore,
  PersonalityType,
} from "@/types";

/**
 * Shared signal-type -> icon mapping (DESIGN.md: "Icons mark signal type ...
 * for fast scanning — never purely decorative", strokeWidth 1.5, outline
 * only). Each consuming card keeps its own META record for label/color —
 * this only adds the icon lookup, so existing per-card business logic
 * doesn't move.
 */
export const MOMENT_ICON: Record<MomentType, LucideIcon> = {
  buying_signal: TrendingUp,
  objection: ShieldAlert,
  pain_point: CircleAlert,
  breakthrough: Lightbulb,
};

export const NEXT_STEP_PRIORITY_ICON: Record<NextStepPriority, LucideIcon> = {
  urgent: Zap,
  soon: Clock,
  "when-possible": CalendarDays,
};

export const OBJECTION_SCORE_ICON: Record<ObjectionScore, LucideIcon> = {
  excellent: CheckCircle2,
  good: CheckCircle2,
  poor: CircleAlert,
  missed: XCircle,
};

/** Positive/negative buying-signal direction (DealIntelligence). */
export const SIGNAL_DIRECTION_ICON = {
  positive: TrendingUp,
  negative: TrendingDown,
} as const;

export const PERSONALITY_TYPE_ICON: Record<PersonalityType, LucideIcon> = {
  Driver: Target,
  Expressive: MessageCircle,
  Amiable: HeartHandshake,
  Analytical: LineChart,
};

/** Shared stroke weight for every signal icon (DESIGN.md: never the 2.0 default). */
export const ICON_STROKE_WIDTH = 1.5;
