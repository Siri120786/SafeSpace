import 'package:flutter/material.dart';
import '../../../models/mood_checkin.dart';

const Map<int, String> intensityDescriptions = {
  1: 'A little',
  2: 'Mild',
  3: 'Moderate',
  4: 'Noticeable',
  5: 'Very strong',
};

class IntensitySelector extends StatelessWidget {
  final int? intensity;
  final ValueChanged<int?> onIntensityChanged;
  final bool disabled;

  const IntensitySelector({
    super.key,
    required this.intensity,
    required this.onIntensityChanged,
    this.disabled = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final levels = List.generate(
      moodIntensityMax - moodIntensityMin + 1,
      (i) => moodIntensityMin + i,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Text(
                  'Intensity',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '(Optional)',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF636E72),
                  ),
                ),
              ],
            ),
            if (intensity != null && !disabled)
              TextButton(
                onPressed: () => onIntensityChanged(null),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: const Size(48, 32),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  'Clear',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'How strong is this feeling? Pick a number from $moodIntensityMin to $moodIntensityMax, or leave it unselected.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: const Color(0xFF636E72),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: levels.map((level) {
            final isSelected = intensity == level;
            final description = intensityDescriptions[level] ?? 'Level $level';

            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(
                  right: level < moodIntensityMax ? 8.0 : 0.0,
                ),
                child: Semantics(
                  button: true,
                  selected: isSelected,
                  enabled: !disabled,
                  label:
                      'Intensity $level of $moodIntensityMax: $description${isSelected ? ', selected' : ''}',
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minWidth: 48,
                      minHeight: 48,
                    ),
                    child: Material(
                      color: isSelected
                          ? theme.colorScheme.primary
                          : Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: isSelected
                              ? theme.colorScheme.primary
                              : const Color(0xFFDFE6E9),
                          width: isSelected ? 2.0 : 1.0,
                        ),
                      ),
                      elevation: isSelected ? 1 : 0,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: disabled
                            ? null
                            : () {
                                if (isSelected) {
                                  onIntensityChanged(null);
                                } else {
                                  onIntensityChanged(level);
                                }
                              },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: 8,
                            horizontal: 2,
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '$level',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: isSelected
                                          ? Colors.white
                                          : const Color(0xFF2D3436),
                                    ),
                                  ),
                                  if (isSelected) ...[
                                    const SizedBox(width: 2),
                                    const Icon(
                                      Icons.check,
                                      size: 14,
                                      color: Colors.white,
                                    ),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 2),
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  description,
                                  maxLines: 1,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: isSelected
                                        ? FontWeight.w600
                                        : FontWeight.normal,
                                    color: isSelected
                                        ? Colors.white.withValues(alpha: 0.95)
                                        : const Color(0xFF636E72),
                                  ),
                                ),
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
          }).toList(),
        ),
      ],
    );
  }
}
