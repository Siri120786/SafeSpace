import 'package:flutter/material.dart';

/// Anxiety module — status: feature list only — not yet built.
/// Module-specific features: breathing, grounding (5-4-3-2-1), guided meditation, mood tracker
/// Shared features (journaling, routines, stories, emergency) are called
/// via the shared feature engine, not reimplemented here — see
/// docs/Architecture_Specification.md section 6.
class AnxietyModule extends StatelessWidget {
  const AnxietyModule({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Anxiety')),
      body: const Center(child: Text('TODO: feature list only — not yet built')),
    );
  }
}
