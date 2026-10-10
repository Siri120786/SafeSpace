import 'package:flutter_test/flutter_test.dart';
import 'package:safespace_mobile/features/profile/models/profile_preferences.dart';

void main() {
  group('Flutter Profile & Preferences Models Contract Tests', () {
    test('ProfileSupportPreferences JSON serialization and deserialization', () {
      final json = {
        'profile_id': 'user-uuid-1234',
        'support_areas': ['autism', 'adhd', 'anxiety'],
        'created_at': '2026-10-10T12:00:00Z',
        'updated_at': '2026-10-10T12:00:00Z',
      };

      final prefs = ProfileSupportPreferences.fromJson(json);

      expect(prefs.profileId, equals('user-uuid-1234'));
      expect(prefs.supportAreas, equals(['autism', 'adhd', 'anxiety']));
      expect(prefs.createdAt, equals('2026-10-10T12:00:00Z'));

      final serialized = prefs.toJson();
      expect(serialized['profile_id'], equals('user-uuid-1234'));
      expect(serialized['support_areas'], equals(['autism', 'adhd', 'anxiety']));
    });

    test('ProfileAccessibilityPreferences JSON serialization & copyWith', () {
      final json = {
        'profile_id': 'user-uuid-5678',
        'reduced_sensory_stimulation': true,
        'larger_text': true,
        'read_aloud': false,
        'simplified_presentation': true,
        'created_at': '2026-10-10T12:00:00Z',
        'updated_at': '2026-10-10T12:00:00Z',
      };

      final prefs = ProfileAccessibilityPreferences.fromJson(json);

      expect(prefs.profileId, equals('user-uuid-5678'));
      expect(prefs.reducedSensoryStimulation, isTrue);
      expect(prefs.largerText, isTrue);
      expect(prefs.readAloud, isFalse);
      expect(prefs.simplifiedPresentation, isTrue);

      final updated = prefs.copyWith(readAloud: true);
      expect(updated.readAloud, isTrue);
      expect(updated.reducedSensoryStimulation, isTrue);

      final serialized = updated.toJson();
      expect(serialized['read_aloud'], isTrue);
      expect(serialized['reduced_sensory_stimulation'], isTrue);
    });

    test('Default Accessibility preferences values', () {
      const prefs = ProfileAccessibilityPreferences(profileId: 'test-id');

      expect(prefs.reducedSensoryStimulation, isFalse);
      expect(prefs.largerText, isFalse);
      expect(prefs.readAloud, isFalse);
      expect(prefs.simplifiedPresentation, isFalse);
    });
  });
}
