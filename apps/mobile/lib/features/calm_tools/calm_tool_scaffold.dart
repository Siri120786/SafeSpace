import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

/// Leaves a calm tool: back if there is a screen to go back to, else the dashboard.
void defaultCalmToolExit(BuildContext context) {
  final router = GoRouter.maybeOf(context);
  if (router == null) {
    Navigator.of(context).maybePop();
  } else if (router.canPop()) {
    router.pop();
  } else {
    router.go('/dashboard');
  }
}

/// Shared frame for calm-tool screens: title, an always-visible Exit button,
/// and the Escape key to exit.
class CalmToolScaffold extends StatelessWidget {
  final String title;
  final bool lowSensory;
  final String? notice;
  final VoidCallback onExit;
  final Widget child;

  const CalmToolScaffold({
    super.key,
    required this.title,
    required this.lowSensory,
    required this.onExit,
    required this.child,
    this.notice,
  });

  @override
  Widget build(BuildContext context) {
    return CallbackShortcuts(
      bindings: <ShortcutActivator, VoidCallback>{
        const SingleActivator(LogicalKeyboardKey.escape): onExit,
      },
      child: Focus(
        autofocus: true,
        child: Scaffold(
          backgroundColor:
              lowSensory ? const Color(0xFFF4F1EA) : const Color(0xFFF1F5E4),
          appBar: AppBar(
            title: Text(title),
            automaticallyImplyLeading: false,
            actions: <Widget>[
              TextButton(
                onPressed: onExit,
                child: const Text('Exit'),
              ),
              const SizedBox(width: 8),
            ],
          ),
          body: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      if (notice != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Semantics(
                            liveRegion: true,
                            child: Text(notice!),
                          ),
                        ),
                      child,
                      const SizedBox(height: 16),
                      const Text(
                        'Press Escape at any time to leave. This is a calming exercise, not medical advice.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
