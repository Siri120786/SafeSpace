class EmergencyEvent {
  final String id;
  final String childId;
  final String triggeredBy;
  final double? classifierScore;
  final String? aiAlertSummary;
  final DateTime? caregiverNotifiedAt;
  final DateTime? reviewedAt;
  final String? reviewedBy;
  final DateTime createdAt;

  EmergencyEvent({
    required this.id,
    required this.childId,
    required this.triggeredBy,
    this.classifierScore,
    this.aiAlertSummary,
    this.caregiverNotifiedAt,
    this.reviewedAt,
    this.reviewedBy,
    required this.createdAt,
  });

  factory EmergencyEvent.fromJson(Map<String, dynamic> json) {
    return EmergencyEvent(
      id: json['id'] as String,
      childId: json['child_id'] as String,
      triggeredBy: json['triggered_by'] as String,
      classifierScore: (json['classifier_score'] as num?)?.toDouble(),
      aiAlertSummary: json['ai_alert_summary'] as String?,
      caregiverNotifiedAt: json['caregiver_notified_at'] != null
          ? DateTime.parse(json['caregiver_notified_at'] as String)
          : null,
      reviewedAt: json['reviewed_at'] != null
          ? DateTime.parse(json['reviewed_at'] as String)
          : null,
      reviewedBy: json['reviewed_by'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
