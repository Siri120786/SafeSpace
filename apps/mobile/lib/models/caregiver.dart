class Caregiver {
  final String id;
  final String? displayName;
  final String familyCode;
  final DateTime createdAt;

  Caregiver({
    required this.id,
    this.displayName,
    required this.familyCode,
    required this.createdAt,
  });

  factory Caregiver.fromJson(Map<String, dynamic> json) {
    return Caregiver(
      id: json['id'] as String,
      displayName: json['display_name'] as String?,
      familyCode: json['family_code'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'display_name': displayName,
      'family_code': familyCode,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
