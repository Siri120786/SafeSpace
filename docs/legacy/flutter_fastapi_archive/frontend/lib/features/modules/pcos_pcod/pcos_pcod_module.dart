import 'package:flutter/material.dart';

/// PcosPcod module — status: feature list only — needs body-image-sensitive design review before building, see architecture spec section 8 item 5.
/// Module-specific features: medication reminders, water tracking, gentle exercise, sleep tracking, stress management
/// Shared features (journaling, routines, stories, emergency) are called
/// via the shared feature engine, not reimplemented here — see
/// docs/Architecture_Specification.md section 6.
class PcosPcodModule extends StatelessWidget {
  const PcosPcodModule({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('PcosPcod')),
      body: const Center(child: Text('TODO: feature list only — needs body-image-sensitive design review before building, see architecture spec section 8 item 5')),
    );
  }
}
