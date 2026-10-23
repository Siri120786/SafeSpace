/// Story workflow rules: draft -> pending_approval -> approved / rejected.
/// Mirror of apps/web story-workflow/lib/storyWorkflow.ts. The word list is a
/// BASIC placeholder check, not real content safety (docs/content-needing-review.md).
library;

enum StoryStatus { draft, pendingApproval, approved, rejected }

const int titleMax = 80;
const int bodyMin = 40;
const int bodyMax = 2000;

const List<String> _flaggedTerms = <String>[
  'kill',
  'die',
  'hurt yourself',
  'suicide',
  'hate yourself',
  'stupid',
  'idiot',
];

String statusLabel(StoryStatus s) {
  switch (s) {
    case StoryStatus.draft:
      return 'Draft';
    case StoryStatus.pendingApproval:
      return 'Waiting for approval';
    case StoryStatus.approved:
      return 'Approved';
    case StoryStatus.rejected:
      return 'Needs changes';
  }
}

class Story {
  final String id;
  final String title;
  final String body;
  final StoryStatus status;
  final String? rejectionReason;

  const Story({
    required this.id,
    required this.title,
    required this.body,
    this.status = StoryStatus.draft,
    this.rejectionReason,
  });

  Story copyWith({StoryStatus? status, String? rejectionReason, bool clearReason = false}) => Story(
        id: id,
        title: title,
        body: body,
        status: status ?? this.status,
        rejectionReason: clearReason ? null : (rejectionReason ?? this.rejectionReason),
      );
}

class TransitionResult {
  final Story? story;
  final String? error;
  const TransitionResult.ok(Story this.story) : error = null;
  const TransitionResult.fail(String this.error) : story = null;
  bool get ok => story != null;
}

List<String> validateStory(String title, String body) {
  final List<String> issues = <String>[];
  final String t = title.trim();
  final String b = body.trim();
  if (t.isEmpty) issues.add('Please add a title.');
  if (t.length > titleMax) issues.add('The title must be $titleMax characters or fewer.');
  if (b.length < bodyMin) {
    issues.add('The story needs at least $bodyMin characters so it can be read properly.');
  }
  if (b.length > bodyMax) issues.add('The story must be $bodyMax characters or fewer.');
  final String lower = '$t $b'.toLowerCase();
  final bool hit = _flaggedTerms.any((w) => RegExp('\\b$w\\b').hasMatch(lower));
  if (hit) {
    issues.add('This story has wording that needs a gentler rewrite before it can be sent for approval.');
  }
  return issues;
}

Story createDraft(String id, String title, String body) => Story(id: id, title: title.trim(), body: body.trim());

TransitionResult submitForApproval(Story s) {
  if (s.status != StoryStatus.draft && s.status != StoryStatus.rejected) {
    return const TransitionResult.fail('Only a draft or a rejected story can be sent for approval.');
  }
  final List<String> issues = validateStory(s.title, s.body);
  if (issues.isNotEmpty) return TransitionResult.fail(issues.first);
  return TransitionResult.ok(s.copyWith(status: StoryStatus.pendingApproval, clearReason: true));
}

TransitionResult approveStory(Story s, bool isCaregiver) {
  if (!isCaregiver) return const TransitionResult.fail('Only a caregiver can approve a story.');
  if (s.status != StoryStatus.pendingApproval) {
    return const TransitionResult.fail('This story is not waiting for approval.');
  }
  return TransitionResult.ok(s.copyWith(status: StoryStatus.approved));
}

TransitionResult rejectStory(Story s, bool isCaregiver, String reason) {
  if (!isCaregiver) return const TransitionResult.fail('Only a caregiver can reject a story.');
  if (s.status != StoryStatus.pendingApproval) {
    return const TransitionResult.fail('This story is not waiting for approval.');
  }
  final String r = reason.trim();
  if (r.isEmpty) return const TransitionResult.fail('Please give a short reason so the story can be improved.');
  return TransitionResult.ok(s.copyWith(status: StoryStatus.rejected, rejectionReason: r));
}

bool canRead(Story s) => s.status == StoryStatus.approved;
