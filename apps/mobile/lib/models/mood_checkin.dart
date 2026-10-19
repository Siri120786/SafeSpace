/// Shared mood check-in contract (Sprint 2). Mirrors `MoodCheckin` in
/// packages/shared-types and the `mood_checkins` table. User-selected
/// feelings, not a clinical assessment.
const List<String> moodValues = [
  'ecstatic',
  'happy',
  'neutral',
  'sad',
  'stressed',
  'overwhelmed',
];

const int moodIntensityMin = 1;
const int moodIntensityMax = 5;
const int moodNoteMaxLength = 500;

class MoodCheckin {
  final String id;
  final String? profileId;
  final String? childId;
  final String mood;
  final int? intensity;
  final String? note;
  final bool isPrivateNote;
  final String createdAt;

  const MoodCheckin({
    required this.id,
    this.profileId,
    this.childId,
    required this.mood,
    this.intensity,
    this.note,
    required this.isPrivateNote,
    required this.createdAt,
  });

  /// Parses a `mood_checkins` row (snake_case). The mood-checkin Edge
  /// Function returns the same row shape.
  factory MoodCheckin.fromJson(Map<String, dynamic> json) {
    return MoodCheckin(
      id: json['id'] as String,
      profileId: json['profile_id'] as String?,
      childId: json['child_id'] as String?,
      mood: json['mood'] as String,
      intensity: json['intensity'] as int?,
      note: json['note'] as String?,
      isPrivateNote: json['is_private_note'] as bool? ?? false,
      createdAt: json['created_at'] as String,
    );
  }
}
