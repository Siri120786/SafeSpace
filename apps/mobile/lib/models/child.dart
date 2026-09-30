class Child {
  final String id;
  final String caregiverId;
  final String name;
  final int age;
  final String privacyTier;
  final DateTime createdAt;

  Child({
    required this.id,
    required this.caregiverId,
    required this.name,
    required this.age,
    required this.privacyTier,
    required this.createdAt,
  });

  factory Child.fromJson(Map<String, dynamic> json) {
    return Child(
      id: json['id'] as String,
      caregiverId: json['caregiver_id'] as String,
      name: json['name'] as String,
      age: json['age'] as int,
      privacyTier: json['privacy_tier'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'caregiver_id': caregiverId,
      'name': name,
      'age': age,
      'privacy_tier': privacyTier,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
