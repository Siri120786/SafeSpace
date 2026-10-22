import 'package:flutter/material.dart';
import '../../../models/mood_checkin.dart';
import '../providers/mood_provider.dart';
import 'mood_option_grid.dart';

String formatCheckInTime(String dateString) {
  try {
    final dateTime = DateTime.parse(dateString).toLocal();
    final now = DateTime.now();

    final isToday = dateTime.year == now.year &&
        dateTime.month == now.month &&
        dateTime.day == now.day;

    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday = dateTime.year == yesterday.year &&
        dateTime.month == yesterday.month &&
        dateTime.day == yesterday.day;

    final hour = dateTime.hour == 0
        ? 12
        : (dateTime.hour > 12 ? dateTime.hour - 12 : dateTime.hour);
    final minute = dateTime.minute.toString().padLeft(2, '0');
    final period = dateTime.hour >= 12 ? 'PM' : 'AM';
    final timeStr = '$hour:$minute $period';

    if (isToday) {
      return 'Today at $timeStr';
    }
    if (isYesterday) {
      return 'Yesterday at $timeStr';
    }

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    final monthStr = months[dateTime.month - 1];

    if (dateTime.year == now.year) {
      return '$monthStr ${dateTime.day} at $timeStr';
    }
    return '$monthStr ${dateTime.day}, ${dateTime.year} at $timeStr';
  } catch (_) {
    return dateString;
  }
}

MoodOptionData? _getMoodOption(String moodId) {
  for (final option in moodOptions) {
    if (option.id == moodId) return option;
  }
  return null;
}

class MoodHistoryList extends StatelessWidget {
  final List<MoodCheckin> history;
  final MoodHistoryStatus status;
  final String? errorMessage;
  final VoidCallback onRetry;

  const MoodHistoryList({
    super.key,
    required this.history,
    required this.status,
    required this.errorMessage,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (status == MoodHistoryStatus.loading && history.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                valueColor:
                    AlwaysStoppedAnimation<Color>(theme.colorScheme.primary),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Loading your history…',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF636E72),
              ),
            ),
          ],
        ),
      );
    }

    if (status == MoodHistoryStatus.error && history.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.red.shade50.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.red.shade200),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              errorMessage ??
                  'Unable to load check-in history. Please try again.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.red.shade800,
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(120, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Try Again'),
            ),
          ],
        ),
      );
    }

    if (history.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
        decoration: BoxDecoration(
          color: const Color(0xFFF4F7EE).withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE0E7D6)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              '🌱',
              style: TextStyle(fontSize: 36),
            ),
            const SizedBox(height: 8),
            Text(
              'No check-ins yet',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: const Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              "Whenever you're ready to check in, your previous reflections will show up here.",
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF636E72),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'My History',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: const Color(0xFF2D3436),
              ),
            ),
            Text(
              '${history.length} ${history.length == 1 ? 'entry' : 'entries'}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF636E72),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: history.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final entry = history[index];
            final option = _getMoodOption(entry.mood);
            final moodLabel = option?.label ?? entry.mood;

            return Semantics(
              label:
                  'Check-in: $moodLabel on ${formatCheckInTime(entry.createdAt)}${entry.intensity != null ? ', Intensity ${entry.intensity} of $moodIntensityMax' : ''}${entry.note != null ? ', Note: ${entry.note}' : ''}',
              child: Material(
                color: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: Color(0xFFDFE6E9)),
                ),
                elevation: 0,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: option?.color ?? const Color(0xFFE0D7C6),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: option?.borderColor ??
                                    const Color(0xFFC7BCA5),
                                width: 2,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              option?.emoji ?? '🙂',
                              style: const TextStyle(fontSize: 20),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  moodLabel,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  formatCheckInTime(entry.createdAt),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF636E72),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (entry.intensity != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.primary
                                    .withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: theme.colorScheme.primary
                                      .withValues(alpha: 0.25),
                                ),
                              ),
                              child: Text(
                                'Intensity: ${entry.intensity}/$moodIntensityMax',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: theme.colorScheme.primary,
                                ),
                              ),
                            ),
                        ],
                      ),
                      if (entry.note != null &&
                          entry.note!.trim().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        const Divider(height: 1, color: Color(0xFFF0F3F5)),
                        const SizedBox(height: 8),
                        Text(
                          entry.note!.trim(),
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF2D3436),
                            height: 1.4,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
