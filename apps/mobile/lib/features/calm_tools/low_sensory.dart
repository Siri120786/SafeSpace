/// Shared low-sensory / reduced-motion rule for calm tools.
///
/// Combines the OS "reduce motion" setting (MediaQuery.disableAnimations) with
/// the saved reduced_sensory_stimulation preference. Either one turns it on.
library;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_provider.dart';
import '../profile/services/profile_service.dart';

bool resolveLowSensory({required bool osReducedMotion, required bool savedPreference}) =>
    osReducedMotion || savedPreference;

/// Loads the saved preference for the signed-in user. Missing row means false.
/// A thrown error is shown to the user by the calm-tool screens.
final savedReducedSensoryProvider = FutureProvider.autoDispose<bool>((ref) async {
  final String? userId = ref.watch(authProvider).userId;
  if (userId == null) return false;
  final prefs = await ProfileService.getAccessibilityPreferences(userId);
  return prefs?.reducedSensoryStimulation ?? false;
});

class LowSensoryInfo {
  final bool lowSensory;
  final String? notice;
  const LowSensoryInfo(this.lowSensory, this.notice);
}

LowSensoryInfo watchLowSensory(BuildContext context, WidgetRef ref) {
  final bool os = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
  final saved = ref.watch(savedReducedSensoryProvider);
  final bool savedValue = saved.maybeWhen(data: (v) => v, orElse: () => false);
  final String? notice = saved.hasError
      ? 'We could not load your saved comfort settings. Using your device setting instead.'
      : null;
  return LowSensoryInfo(
    resolveLowSensory(osReducedMotion: os, savedPreference: savedValue),
    notice,
  );
}
