import 'package:flutter/material.dart';

/// Autism module — status: prototype exists — port logic from the standalone HTML prototype.
/// Module-specific features: visual schedules, routine planner, emotion cards, low sensory mode, social stories, reminders
/// Shared features (journaling, routines, stories, emergency) are called
/// via the shared feature engine, not reimplemented here — see
/// docs/Architecture_Specification.md section 6.
class AutismModule extends StatelessWidget {
  const AutismModule({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Autism')),
      body: const Center(child: Text('TODO: prototype exists — port logic from the standalone HTML prototype')),
    );
  }
}
