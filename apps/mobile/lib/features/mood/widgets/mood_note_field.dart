import 'package:flutter/material.dart';
import '../../../models/mood_checkin.dart';

class MoodNoteField extends StatefulWidget {
  final String note;
  final ValueChanged<String> onNoteChanged;
  final bool disabled;

  const MoodNoteField({
    super.key,
    required this.note,
    required this.onNoteChanged,
    this.disabled = false,
  });

  @override
  State<MoodNoteField> createState() => _MoodNoteFieldState();
}

class _MoodNoteFieldState extends State<MoodNoteField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.note);
  }

  @override
  void didUpdateWidget(covariant MoodNoteField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.note != widget.note && _controller.text != widget.note) {
      _controller.value = _controller.value.copyWith(
        text: widget.note,
        selection: TextSelection.collapsed(offset: widget.note.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currentLength = widget.note.length;
    final isAtLimit = currentLength >= moodNoteMaxLength;
    final isNearLimit = currentLength >= (moodNoteMaxLength * 0.85).toInt();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Text(
                  'Add a note',
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
            Semantics(
              liveRegion: true,
              label: '$currentLength of $moodNoteMaxLength characters',
              child: Text(
                '$currentLength / $moodNoteMaxLength',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isAtLimit
                      ? FontWeight.bold
                      : (isNearLimit ? FontWeight.w600 : FontWeight.normal),
                  color: isAtLimit
                      ? Colors.red.shade700
                      : (isNearLimit
                          ? Colors.amber.shade800
                          : const Color(0xFF636E72)),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Semantics(
          label: 'Optional note input',
          hint: 'What is on your mind? Take your time.',
          child: TextField(
            controller: _controller,
            enabled: !widget.disabled,
            maxLength: moodNoteMaxLength,
            maxLines: 3,
            minLines: 3,
            textCapitalization: TextCapitalization.sentences,
            buildCounter: (
              context, {
              required currentLength,
              required isFocused,
              maxLength,
            }) =>
                null,
            onChanged: widget.onNoteChanged,
            decoration: InputDecoration(
              hintText:
                  "What's on your mind? (Only if you'd like to share, take your time)",
              hintStyle: const TextStyle(
                fontSize: 14,
                color: Color(0xFFB2BEC3),
              ),
              contentPadding: const EdgeInsets.all(14),
              filled: true,
              fillColor: isAtLimit
                  ? Colors.amber.shade50.withValues(alpha: 0.3)
                  : Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: const BorderSide(color: Color(0xFFDFE6E9)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(
                  color: isAtLimit
                      ? Colors.amber.shade400
                      : const Color(0xFFDFE6E9),
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(
                  color: theme.colorScheme.primary,
                  width: 2,
                ),
              ),
            ),
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF2D3436),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Your notes are just for you to look back on how you were doing.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: const Color(0xFF636E72),
          ),
        ),
      ],
    );
  }
}
