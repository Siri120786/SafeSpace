import 'package:flutter/material.dart';

/// Adhd module — status: feature list only — not yet built.
/// Module-specific features: focus timer, Pomodoro, task breakdown, habit tracker, reminders, reward system
/// Shared features (journaling, routines, stories, emergency) are called
/// via the shared feature engine, not reimplemented here — see
/// docs/Architecture_Specification.md section 6.
class AdhdModule extends StatelessWidget {
  const AdhdModule({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Adhd')),
      body: const Center(child: Text('TODO: feature list only — not yet built')),
    );
  }
}
