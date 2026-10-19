import '../../../models/mood_checkin.dart';
import '../../../services/supabase_service.dart';

/// Flutter side of the shared mood check-in contract. Same behaviour as
/// packages/api-client/src/mood.ts: adults use the table under RLS, children
/// go through the mood-checkin Edge Function with their session token.
class MoodService {
  static const _columns =
      'id, profile_id, child_id, mood, intensity, note, is_private_note, created_at';
  static const _defaultLimit = 30;
  static const _maxLimit = 100;

  static int _clampLimit(int? limit) {
    if (limit == null || limit < 1) return _defaultLimit;
    return limit > _maxLimit ? _maxLimit : limit;
  }

  /// Validates input so the UI can show a readable error. The database and
  /// Edge Function re-check everything.
  static String? _cleanNote(String? note) {
    final trimmed = note?.trim();
    if (trimmed == null || trimmed.isEmpty) return null;
    if (trimmed.length > moodNoteMaxLength) {
      throw ArgumentError('note_too_long');
    }
    return trimmed;
  }

  static void _validate(String mood, int? intensity) {
    if (!moodValues.contains(mood)) throw ArgumentError('invalid_mood');
    if (intensity != null &&
        (intensity < moodIntensityMin || intensity > moodIntensityMax)) {
      throw ArgumentError('invalid_intensity');
    }
  }

  /// Adult (Supabase Auth) user saves their own check-in.
  static Future<MoodCheckin> createForProfile({
    required String profileId,
    required String mood,
    int? intensity,
    String? note,
  }) async {
    _validate(mood, intensity);
    final response = await SupabaseService.client
        .from('mood_checkins')
        .insert({
          'profile_id': profileId,
          'mood': mood,
          'intensity': intensity,
          'note': _cleanNote(note),
        })
        .select(_columns)
        .single();
    return MoodCheckin.fromJson(response);
  }

  /// Adult user's own history, newest first.
  static Future<List<MoodCheckin>> listForProfile(String profileId,
      {int? limit}) async {
    final response = await SupabaseService.client
        .from('mood_checkins')
        .select(_columns)
        .eq('profile_id', profileId)
        .order('created_at', ascending: false)
        .limit(_clampLimit(limit));
    return (response as List<dynamic>)
        .map((row) => MoodCheckin.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// Child session saves a check-in via the Edge Function.
  static Future<MoodCheckin> createForChild({
    required String childSessionToken,
    required String mood,
    int? intensity,
    String? note,
    bool isPrivateNote = false,
  }) async {
    _validate(mood, intensity);
    final response = await SupabaseService.client.functions.invoke(
      'mood-checkin',
      body: {
        'action': 'create',
        'child_session_token': childSessionToken,
        'mood': mood,
        'intensity': intensity,
        'note': _cleanNote(note),
        'is_private_note': isPrivateNote,
      },
    );
    final data = response.data as Map<String, dynamic>;
    return MoodCheckin.fromJson(data['checkin'] as Map<String, dynamic>);
  }

  /// Child's own history via the Edge Function, newest first.
  static Future<List<MoodCheckin>> listForChild(String childSessionToken,
      {int? limit}) async {
    final response = await SupabaseService.client.functions.invoke(
      'mood-checkin',
      body: {
        'action': 'list',
        'child_session_token': childSessionToken,
        'limit': _clampLimit(limit),
      },
    );
    final data = response.data as Map<String, dynamic>;
    return (data['checkins'] as List<dynamic>? ?? [])
        .map((row) => MoodCheckin.fromJson(row as Map<String, dynamic>))
        .toList();
  }
}
