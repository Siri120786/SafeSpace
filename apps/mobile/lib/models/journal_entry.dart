class JournalEntry {
  final String id;
  final String childId;
  final String moduleKey;
  final String content;
  final Map<String, dynamic>? sentimentFlags;
  final bool isPrivateNote;
  final DateTime createdAt;

  JournalEntry({
    required this.id,
    required this.childId,
    required this.moduleKey,
    required this.content,
    this.sentimentFlags,
    required this.isPrivateNote,
    required this.createdAt,
  });

  factory JournalEntry.fromJson(Map<String, dynamic> json) {
    return JournalEntry(
      id: json['id'] as String,
      childId: json['child_id'] as String,
      moduleKey: json['module_key'] as String,
      content: json['content'] as String,
      sentimentFlags: json['sentiment_flags'] as Map<String, dynamic>?,
      isPrivateNote: json['is_private_note'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
