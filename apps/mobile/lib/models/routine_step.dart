class RoutineStep {
  final String id;
  final String childId;
  final String moduleKey;
  final String label;
  final String? scheduledTime;
  final bool isComplete;
  final int orderIndex;
  final DateTime createdAt;

  RoutineStep({
    required this.id,
    required this.childId,
    required this.moduleKey,
    required this.label,
    this.scheduledTime,
    required this.isComplete,
    required this.orderIndex,
    required this.createdAt,
  });

  factory RoutineStep.fromJson(Map<String, dynamic> json) {
    return RoutineStep(
      id: json['id'] as String,
      childId: json['child_id'] as String,
      moduleKey: json['module_key'] as String,
      label: json['label'] as String,
      scheduledTime: json['scheduled_time'] as String?,
      isComplete: json['is_complete'] as bool? ?? false,
      orderIndex: json['order_index'] as int? ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
