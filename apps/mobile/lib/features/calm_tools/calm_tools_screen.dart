import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'calm_tool_scaffold.dart';
import 'low_sensory.dart';

/// Menu of calm tools. Routes: /calm-tools/breathing and /calm-tools/grounding.
class CalmToolsScreen extends ConsumerWidget {
  const CalmToolsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final LowSensoryInfo sensory = watchLowSensory(context, ref);
    return CalmToolScaffold(
      title: 'Calm tools',
      lowSensory: sensory.lowSensory,
      notice: sensory.notice,
      onExit: () => defaultCalmToolExit(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const Text(
              'Pick something gentle to do. There is no sound, and you can leave at any time.'),
          const SizedBox(height: 16),
          _ToolCard(
            title: 'Breathing exercise',
            subtitle: 'About 2 minutes. Slow breathing with clear written steps.',
            onTap: () => context.push('/calm-tools/breathing'),
          ),
          const SizedBox(height: 12),
          _ToolCard(
            title: '5-4-3-2-1 grounding',
            subtitle: 'Use your five senses to come back to the present.',
            onTap: () => context.push('/calm-tools/grounding'),
          ),
        ],
      ),
    );
  }
}

class _ToolCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  const _ToolCard({required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
