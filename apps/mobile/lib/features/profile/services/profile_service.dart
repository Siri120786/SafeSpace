import '../../../services/supabase_service.dart';
import '../models/profile_preferences.dart';

class ProfileService {
  static Future<ProfileSupportPreferences?> getSupportPreferences(
      String profileId) async {
    try {
      final client = SupabaseService.client;
      final response = await client
          .from('profile_support_preferences')
          .select('profile_id, support_areas, created_at, updated_at')
          .eq('profile_id', profileId)
          .maybeSingle();

      if (response == null) return null;
      return ProfileSupportPreferences.fromJson(response);
    } catch (_) {
      return null;
    }
  }

  static Future<ProfileSupportPreferences> saveSupportPreferences({
    required String profileId,
    required List<String> supportAreas,
  }) async {
    final client = SupabaseService.client;
    final response = await client
        .from('profile_support_preferences')
        .upsert(
          {
            'profile_id': profileId,
            'support_areas': supportAreas,
          },
          onConflict: 'profile_id',
        )
        .select('profile_id, support_areas, created_at, updated_at')
        .single();

    return ProfileSupportPreferences.fromJson(response);
  }

  static Future<ProfileAccessibilityPreferences?> getAccessibilityPreferences(
      String profileId) async {
    try {
      final client = SupabaseService.client;
      final response = await client
          .from('profile_accessibility_preferences')
          .select(
              'profile_id, reduced_sensory_stimulation, larger_text, read_aloud, simplified_presentation, created_at, updated_at')
          .eq('profile_id', profileId)
          .maybeSingle();

      if (response == null) return null;
      return ProfileAccessibilityPreferences.fromJson(response);
    } catch (_) {
      return null;
    }
  }

  static Future<ProfileAccessibilityPreferences> saveAccessibilityPreferences({
    required String profileId,
    required bool reducedSensoryStimulation,
    required bool largerText,
    required bool readAloud,
    required bool simplifiedPresentation,
  }) async {
    final client = SupabaseService.client;
    final response = await client
        .from('profile_accessibility_preferences')
        .upsert(
          {
            'profile_id': profileId,
            'reduced_sensory_stimulation': reducedSensoryStimulation,
            'larger_text': largerText,
            'read_aloud': readAloud,
            'simplified_presentation': simplifiedPresentation,
          },
          onConflict: 'profile_id',
        )
        .select(
            'profile_id, reduced_sensory_stimulation, larger_text, read_aloud, simplified_presentation, created_at, updated_at')
        .single();

    return ProfileAccessibilityPreferences.fromJson(response);
  }

  static Future<void> updateUserProfile({
    required String profileId,
    required String displayName,
  }) async {
    final client = SupabaseService.client;
    await client
        .from('profiles')
        .update({'display_name': displayName})
        .eq('id', profileId);
  }

  static Future<void> completeOnboarding(String profileId) async {
    final client = SupabaseService.client;
    await client
        .from('profiles')
        .update({'onboarding_state': 'completed'})
        .eq('id', profileId);
  }
}
