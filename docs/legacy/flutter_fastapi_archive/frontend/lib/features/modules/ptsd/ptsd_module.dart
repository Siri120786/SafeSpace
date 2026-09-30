import 'package:flutter/material.dart';

/// Ptsd module — status: feature list only — not yet built.
/// Module-specific features: grounding, safe-space mode, relaxation audio
/// Shared features (journaling, routines, stories, emergency) are called
/// via the shared feature engine, not reimplemented here — see
/// docs/Architecture_Specification.md section 6.
class PtsdModule extends StatelessWidget {
  const PtsdModule({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ptsd')),
      body: const Center(child: Text('TODO: feature list only — not yet built')),
    );
  }
}
