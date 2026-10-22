/// Pure breathing-exercise logic (mirror of apps/web calm-tools/lib/breathing.ts).
library;

enum BreathingPhase { inhale, hold, exhale }

class BreathingPattern {
  final int inhaleSeconds;
  final int holdSeconds;
  final int exhaleSeconds;
  final int cycles;

  const BreathingPattern({
    this.inhaleSeconds = 4,
    this.holdSeconds = 4,
    this.exhaleSeconds = 6,
    this.cycles = 5,
  });

  int get cycleSeconds => inhaleSeconds + holdSeconds + exhaleSeconds;
  int get totalSeconds => cycleSeconds * cycles;
}

const BreathingPattern defaultBreathingPattern = BreathingPattern();

String phaseLabel(BreathingPhase phase) {
  switch (phase) {
    case BreathingPhase.inhale:
      return 'Breathe in';
    case BreathingPhase.hold:
      return 'Hold';
    case BreathingPhase.exhale:
      return 'Breathe out';
  }
}

String phaseInstruction(BreathingPhase phase) {
  switch (phase) {
    case BreathingPhase.inhale:
      return 'Breathe in slowly through your nose';
    case BreathingPhase.hold:
      return 'Hold gently. Keep your shoulders relaxed';
    case BreathingPhase.exhale:
      return 'Breathe out slowly through your mouth';
  }
}

class BreathingState {
  final BreathingPhase phase;
  final int secondsLeft;
  final int cycle;
  final double phaseProgress;
  final bool finished;

  const BreathingState({
    required this.phase,
    required this.secondsLeft,
    required this.cycle,
    required this.phaseProgress,
    required this.finished,
  });
}

/// Works out the state from real elapsed time, so a delayed timer tick
/// cannot make the exercise drift.
BreathingState getBreathingState(
  Duration elapsed, [
  BreathingPattern pattern = defaultBreathingPattern,
]) {
  final double seconds = elapsed.isNegative ? 0 : elapsed.inMicroseconds / 1e6;

  if (seconds >= pattern.totalSeconds) {
    return BreathingState(
      phase: BreathingPhase.exhale,
      secondsLeft: 0,
      cycle: pattern.cycles,
      phaseProgress: 1,
      finished: true,
    );
  }

  final int cycleIndex = (seconds / pattern.cycleSeconds).floor();
  final double inCycle = seconds - cycleIndex * pattern.cycleSeconds;

  BreathingPhase phase;
  int phaseStart;
  int phaseLength;
  if (inCycle < pattern.inhaleSeconds) {
    phase = BreathingPhase.inhale;
    phaseStart = 0;
    phaseLength = pattern.inhaleSeconds;
  } else if (inCycle < pattern.inhaleSeconds + pattern.holdSeconds) {
    phase = BreathingPhase.hold;
    phaseStart = pattern.inhaleSeconds;
    phaseLength = pattern.holdSeconds;
  } else {
    phase = BreathingPhase.exhale;
    phaseStart = pattern.inhaleSeconds + pattern.holdSeconds;
    phaseLength = pattern.exhaleSeconds;
  }

  final double intoPhase = inCycle - phaseStart;
  final int left = (phaseLength - intoPhase).ceil();
  return BreathingState(
    phase: phase,
    secondsLeft: left < 1 ? 1 : left,
    cycle: cycleIndex + 1,
    phaseProgress: (intoPhase / phaseLength).clamp(0.0, 1.0),
    finished: false,
  );
}
