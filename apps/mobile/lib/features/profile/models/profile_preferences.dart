class ProfileSupportPreferences {
  final String profileId;
  final List<String> supportAreas;
  final String? createdAt;
  final String? updatedAt;

  const ProfileSupportPreferences({
    required this.profileId,
    required this.supportAreas,
    this.createdAt,
    this.updatedAt,
  });

  factory ProfileSupportPreferences.fromJson(Map<String, dynamic> json) {
    return ProfileSupportPreferences(
      profileId: json['profile_id'] as String,
      supportAreas: (json['support_areas'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'profile_id': profileId,
      'support_areas': supportAreas,
    };
  }
}

class ProfileAccessibilityPreferences {
  final String profileId;
  final bool reducedSensoryStimulation;
  final bool largerText;
  final bool readAloud;
  final bool simplifiedPresentation;
  final String? createdAt;
  final String? updatedAt;

  const ProfileAccessibilityPreferences({
    required this.profileId,
    this.reducedSensoryStimulation = false,
    this.largerText = false,
    this.readAloud = false,
    this.simplifiedPresentation = false,
    this.createdAt,
    this.updatedAt,
  });

  factory ProfileAccessibilityPreferences.fromJson(Map<String, dynamic> json) {
    return ProfileAccessibilityPreferences(
      profileId: json['profile_id'] as String,
      reducedSensoryStimulation:
          json['reduced_sensory_stimulation'] as bool? ?? false,
      largerText: json['larger_text'] as bool? ?? false,
      readAloud: json['read_aloud'] as bool? ?? false,
      simplifiedPresentation: json['simplified_presentation'] as bool? ?? false,
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'profile_id': profileId,
      'reduced_sensory_stimulation': reducedSensoryStimulation,
      'larger_text': largerText,
      'read_aloud': readAloud,
      'simplified_presentation': simplifiedPresentation,
    };
  }

  ProfileAccessibilityPreferences copyWith({
    bool? reducedSensoryStimulation,
    bool? largerText,
    bool? readAloud,
    bool? simplifiedPresentation,
  }) {
    return ProfileAccessibilityPreferences(
      profileId: profileId,
      reducedSensoryStimulation:
          reducedSensoryStimulation ?? this.reducedSensoryStimulation,
      largerText: largerText ?? this.largerText,
      readAloud: readAloud ?? this.readAloud,
      simplifiedPresentation:
          simplifiedPresentation ?? this.simplifiedPresentation,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
