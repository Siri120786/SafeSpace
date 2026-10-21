import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'calm_tool_scaffold.dart';
import 'grounding_logic.dart';
import 'low_sensory.dart';

class GroundingScreen extends ConsumerStatefulWidget {
  final VoidCallback? onExit;
  const GroundingScreen({super.key, this.onExit});

  @override
  ConsumerState<GroundingScreen> createState() => _GroundingScreenState();
}

class _GroundingScreenState extends ConsumerState<GroundingScreen> {
  int _index = 0;
  bool _done = false;

  @override
  Widget build(BuildContext context) {
    final LowSensoryInfo sensory = watchLowSensory(context, ref);
    final VoidCallback exit = widget.onExit ?? () => defaultCalmToolExit(context);
    final GroundingStep step = groundingSteps[_index];

    return CalmToolScaffold(
      title: '5-4-3-2-1 grounding',
      lowSensory: sensory.lowSensory,
      notice: sensory.notice,
      onExit: exit,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: _done
              ? Column(
                  children: <Widget>[
                    const Text('Well done',
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    const Text(
                      'You noticed your surroundings with all five senses. Take one slow breath before you go on.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      alignment: WrapAlignment.center,
                      children: <Widget>[
                        OutlinedButton(
                          onPressed: () => setState(() {
                            _index = 0;
                            _done = false;
                          }),
                          child: const Text('Do it again'),
                        ),
                        FilledButton(onPressed: exit, child: const Text('Finish')),
                      ],
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Step ${_index + 1} of ${groundingSteps.length}',
                        style: const TextStyle(color: Colors.black54)),
                    const SizedBox(height: 12),
                    Semantics(
                      liveRegion: true,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(step.title,
                              style: const TextStyle(
                                  fontSize: 24, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 8),
                          Text(step.instruction,
                              style: const TextStyle(fontSize: 16, height: 1.4)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: <Widget>[
                        OutlinedButton(
                          onPressed: _index == 0
                              ? null
                              : () => setState(() => _index = prevStepIndex(_index)),
                          child: const Text('Back'),
                        ),
                        if (isLastStep(_index))
                          FilledButton(
                            onPressed: () => setState(() => _done = true),
                            child: const Text('Done'),
                          )
                        else
                          FilledButton(
                            onPressed: () =>
                                setState(() => _index = nextStepIndex(_index)),
                            child: const Text('Next'),
                          ),
                      ],
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
