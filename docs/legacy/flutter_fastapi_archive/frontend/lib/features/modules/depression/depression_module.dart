import 'package:flutter/material.dart';

/// Depression module — status: feature list only — not yet built.
/// Module-specific features: daily check-ins, small goals, positive reinforcement, hobby suggestions
/// Shared features (journaling, routines, stories, emergency) are called
/// via the shared feature engine, not reimplemented here — see
/// docs/Architecture_Specification.md section 6.
class DepressionModule extends StatelessWidget {
  const DepressionModule({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Depression')),
      body: const Center(child: Text('TODO: feature list only — not yet built')),
    );
  }
}
