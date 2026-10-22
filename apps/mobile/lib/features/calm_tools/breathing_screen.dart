import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'breathing_logic.dart';
import 'calm_tool_scaffold.dart';
import 'low_sensory.dart';

class BreathingScreen extends ConsumerStatefulWidget {
  final VoidCallback? onExit;
  const BreathingScreen({super.key, this.onExit});

  @override
  ConsumerState<BreathingScreen> createState() => _BreathingScreenState();
}

class _BreathingScreenState extends ConsumerState<BreathingScreen> {
  static const BreathingPattern _pattern = defaultBreathingPattern;
  final Stopwatch _stopwatch = Stopwatch();
  Timer? _timer;
  Duration _elapsed = Duration.zero;

  Duration get _total => Duration(seconds: _pattern.totalSeconds);
  bool get _running => _stopwatch.isRunning;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _tick() {
    final Duration elapsed = _stopwatch.elapsed;
    if (elapsed >= _total) {
      _stopwatch.stop();
      _timer?.cancel();
      setState(() => _elapsed = _total);
      return;
    }
    setState(() => _elapsed = elapsed);
  }

  void _start() {
    if (_elapsed >= _total) {
      _stopwatch.reset();
      _elapsed = Duration.zero;
    }
    _stopwatch.start();
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 100), (_) => _tick());
    setState(() {});
  }

  void _pause() {
    _stopwatch.stop();
    _timer?.cancel();
    setState(() => _elapsed = _stopwatch.elapsed);
  }

  void _reset() {
    _stopwatch.stop();
    _stopwatch.reset();
    _timer?.cancel();
    setState(() => _elapsed = Duration.zero);
  }

  @override
  Widget build(BuildContext context) {
    final LowSensoryInfo sensory = watchLowSensory(context, ref);
    final BreathingState state = getBreathingState(_elapsed, _pattern);
    final bool notStarted = !_running && _elapsed == Duration.zero;
    final bool paused = !_running && _elapsed > Duration.zero && !state.finished;
    final bool active = _running || paused;

    String headline;
    String detail;
    if (state.finished) {
      headline = 'Well done';
      detail = 'You finished your breathing session. Notice how your body feels now.';
    } else if (notStarted) {
      headline = 'Ready when you are';
      detail =
          'Press Start. You will breathe in for ${_pattern.inhaleSeconds}, hold for ${_pattern.holdSeconds}, and breathe out for ${_pattern.exhaleSeconds}, ${_pattern.cycles} times.';
    } else if (paused) {
      headline = 'Paused';
      detail = 'Press Resume when you are ready to carry on, or Reset to start again.';
    } else {
      headline = phaseLabel(state.phase);
      detail = phaseInstruction(state.phase);
    }

    final bool growing =
        state.phase == BreathingPhase.inhale || state.phase == BreathingPhase.hold;
    final double scale = sensory.lowSensory || !active ? 1.0 : (growing ? 1.25 : 0.85);
    final int phaseSeconds = state.phase == BreathingPhase.inhale
        ? _pattern.inhaleSeconds
        : state.phase == BreathingPhase.hold
            ? _pattern.holdSeconds
            : _pattern.exhaleSeconds;

    return CalmToolScaffold(
      title: 'Breathing exercise',
      lowSensory: sensory.lowSensory,
      notice: sensory.notice,
      onExit: widget.onExit ?? () => defaultCalmToolExit(context),
      child: Column(
        children: <Widget>[
          const SizedBox(height: 16),
          ExcludeSemantics(
            child: Center(
              child: AnimatedScale(
                scale: scale,
                duration: sensory.lowSensory
                    ? Duration.zero
                    : Duration(seconds: phaseSeconds),
                curve: Curves.easeInOut,
                child: Container(
                  key: const Key('breathing-circle'),
                  width: 160,
                  height: 160,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFE6EEC4),
                    border: Border.all(color: const Color(0xFF8DA568), width: 4),
                  ),
                  child: Text(
                    active && !state.finished ? '${state.secondsLeft}' : '',
                    style: const TextStyle(fontSize: 40),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Semantics(
            liveRegion: true,
            child: Column(
              children: <Widget>[
                Text(headline,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Text(detail, textAlign: TextAlign.center),
              ],
            ),
          ),
          if (!notStarted) ...<Widget>[
            const SizedBox(height: 12),
            Text('Breath ${state.cycle.clamp(1, _pattern.cycles)} of ${_pattern.cycles}'),
          ],
          const SizedBox(height: 24),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 12,
            runSpacing: 12,
            children: <Widget>[
              if (_running)
                FilledButton(onPressed: _pause, child: const Text('Pause'))
              else
                FilledButton(
                  onPressed: _start,
                  child: Text(state.finished
                      ? 'Start again'
                      : paused
                          ? 'Resume'
                          : 'Start'),
                ),
              OutlinedButton(
                onPressed: notStarted ? null : _reset,
                child: const Text('Reset'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
