import 'package:flutter/material.dart';

class MoodOptionData {
  final String id;
  final String label;
  final Color color;
  final Color bgColor;
  final Color borderColor;
  final String emoji;

  const MoodOptionData({
    required this.id,
    required this.label,
    required this.color,
    required this.bgColor,
    required this.borderColor,
    required this.emoji,
  });
}

const List<MoodOptionData> moodOptions = [
  MoodOptionData(
    id: 'ecstatic',
    label: 'Ecstatic',
    color: Color(0xFFFFD966),
    bgColor: Color(0xFFFFF9E6),
    borderColor: Color(0xFFF7C948),
    emoji: '🤩',
  ),
  MoodOptionData(
    id: 'happy',
    label: 'Happy',
    color: Color(0xFF8DA568),
    bgColor: Color(0xFFF4F7EE),
    borderColor: Color(0xFF8DA568),
    emoji: '😊',
  ),
  MoodOptionData(
    id: 'neutral',
    label: 'Neutral',
    color: Color(0xFFE0D7C6),
    bgColor: Color(0xFFFAF7F2),
    borderColor: Color(0xFFC7BCA5),
    emoji: '😐',
  ),
  MoodOptionData(
    id: 'sad',
    label: 'Down',
    color: Color(0xFFA4C2F4),
    bgColor: Color(0xFFEFF4FC),
    borderColor: Color(0xFF6D9EEB),
    emoji: '😔',
  ),
  MoodOptionData(
    id: 'stressed',
    label: 'Stressed',
    color: Color(0xFFD9D2E9),
    bgColor: Color(0xFFF3F0F8),
    borderColor: Color(0xFFB4A7D6),
    emoji: '😰',
  ),
  MoodOptionData(
    id: 'overwhelmed',
    label: 'Overwhelmed',
    color: Color(0xFFF6B26B),
    bgColor: Color(0xFFFDF3E7),
    borderColor: Color(0xFFE69138),
    emoji: '🤯',
  ),
];

class MoodOptionGrid extends StatelessWidget {
  final String? selectedMood;
  final ValueChanged<String> onMoodSelected;
  final bool disabled;

  const MoodOptionGrid({
    super.key,
    required this.selectedMood,
    required this.onMoodSelected,
    this.disabled = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final disableAnimations =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final textScaleFactor = MediaQuery.textScalerOf(context).scale(1.0);
    final double childAspectRatio = textScaleFactor > 1.2
        ? 0.72
        : (textScaleFactor > 1.0 ? 0.80 : 0.88);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'How are you feeling right now?',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: const Color(0xFF2D3436),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Pick the feeling that closest matches your state. Take your time.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: const Color(0xFF636E72),
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: moodOptions.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: childAspectRatio,
          ),
          itemBuilder: (context, index) {
            final option = moodOptions[index];
            final isSelected = selectedMood == option.id;

            return Semantics(
              button: true,
              selected: isSelected,
              enabled: !disabled,
              label: '${option.label} mood${isSelected ? ', selected' : ''}',
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  minWidth: 48,
                  minHeight: 48,
                ),
                child: Material(
                  color: isSelected ? option.bgColor : Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(
                      color: isSelected
                          ? theme.colorScheme.primary
                          : option.borderColor.withValues(alpha: 0.6),
                      width: isSelected ? 2.5 : 1.0,
                    ),
                  ),
                  elevation: isSelected ? 2 : 0,
                  shadowColor: theme.colorScheme.primary.withValues(alpha: 0.2),
                  child: InkWell(
                    onTap: disabled ? null : () => onMoodSelected(option.id),
                    borderRadius: BorderRadius.circular(16),
                    child: AnimatedContainer(
                      duration: disableAnimations
                          ? Duration.zero
                          : const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 10,
                      ),
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: option.color,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: option.borderColor,
                                      width: 2,
                                    ),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    option.emoji,
                                    style: const TextStyle(fontSize: 24),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Text(
                                    option.label,
                                    maxLines: 1,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: isSelected
                                          ? FontWeight.bold
                                          : FontWeight.w500,
                                      color: isSelected
                                          ? theme.colorScheme.primary
                                          : const Color(0xFF2D3436),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (isSelected)
                            Positioned(
                              top: 0,
                              right: 0,
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: BoxDecoration(
                                  color: theme.colorScheme.primary,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.check,
                                  size: 14,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
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
