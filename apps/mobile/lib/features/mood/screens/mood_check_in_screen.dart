// NOTE: Child sessions are not supported on mobile until child PIN login is wired.
// Child PIN verification is still a placeholder on mobile, so child tokens cannot
// be exercised end-to-end here yet. Once child auth is wired, this screen will support
// child session flows and switch between adult and child views accordingly.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../widgets/custom_button.dart';
import '../providers/mood_provider.dart';
import '../widgets/intensity_selector.dart';
import '../widgets/mood_history_list.dart';
import '../widgets/mood_note_field.dart';
import '../widgets/mood_option_grid.dart';

class MoodCheckInScreen extends ConsumerWidget {
  const MoodCheckInScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final moodState = ref.watch(moodProvider);
    final moodNotifier = ref.read(moodProvider.notifier);

    final isSaving = moodState.status == MoodCheckinStatus.saving;
    final canSave = moodState.selectedMood != null && !isSaving;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mood Check-in'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            }
          },
          tooltip: 'Back',
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Saved success confirmation
              if (moodState.status == MoodCheckinStatus.saved) ...[
                Semantics(
                  liveRegion: true,
                  label: 'Check-in saved successfully',
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF4F7EE),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF8DA568)),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.check_circle_rounded,
                          color: Color(0xFF8DA568),
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Your check-in has been saved.',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () => moodNotifier.resetForm(),
                          tooltip: 'Dismiss confirmation',
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(
                            minWidth: 32,
                            minHeight: 32,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Error banner with retry
              if (moodState.status == MoodCheckinStatus.error &&
                  moodState.errorMessage != null) ...[
                Semantics(
                  liveRegion: true,
                  label: 'Error: ${moodState.errorMessage}',
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50.withValues(alpha: 0.8),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.error_outline_rounded,
                          color: Colors.red.shade700,
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                moodState.errorMessage!,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.red.shade900,
                                ),
                              ),
                              const SizedBox(height: 6),
                              TextButton(
                                onPressed: () => moodNotifier.retrySave(),
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(60, 32),
                                  tapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: Text(
                                  'Try Again',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.red.shade800,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () => moodNotifier.clearError(),
                          tooltip: 'Dismiss error',
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(
                            minWidth: 32,
                            minHeight: 32,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // 1. Mood Option Grid
              MoodOptionGrid(
                selectedMood: moodState.selectedMood,
                onMoodSelected: (mood) => moodNotifier.selectMood(mood),
                disabled: isSaving,
              ),
              const SizedBox(height: 24),

              // 2. Optional Intensity Selector
              IntensitySelector(
                intensity: moodState.intensity,
                onIntensityChanged: (val) => moodNotifier.setIntensity(val),
                disabled: isSaving,
              ),
              const SizedBox(height: 24),

              // 3. Optional Note Field
              MoodNoteField(
                note: moodState.note,
                onNoteChanged: (text) => moodNotifier.setNote(text),
                disabled: isSaving,
              ),
              const SizedBox(height: 24),

              // 4. Save Button (disabled until mood is chosen or while saving)
              Semantics(
                button: true,
                enabled: canSave,
                label: isSaving ? 'Saving check-in' : 'Save check-in',
                child: IgnorePointer(
                  ignoring: !canSave,
                  child: Opacity(
                    opacity: canSave ? 1.0 : 0.45,
                    child: CustomButton(
                      label: isSaving ? 'Saving…' : 'Save Check-in',
                      onPressed: canSave
                          ? () => moodNotifier.saveCheckin()
                          : () {},
                      backgroundColor: canSave
                          ? theme.colorScheme.primary
                          : const Color(0xFFB2BEC3),
                      textColor: Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32),

              // 5. Divider
              const Divider(height: 1, color: Color(0xFFDFE6E9)),
              const SizedBox(height: 24),

              // 6. History Section
              MoodHistoryList(
                history: moodState.history,
                status: moodState.historyStatus,
                errorMessage: moodState.historyErrorMessage,
                onRetry: () => moodNotifier.loadHistory(),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
