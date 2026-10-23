import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_provider.dart';
import '../calm_tools/calm_tool_scaffold.dart';
import '../calm_tools/low_sensory.dart';
import 'story_logic.dart';

/// Caregiver story workflow. Prototype: stories live only while this screen is open.
class StoryWorkflowScreen extends ConsumerStatefulWidget {
  /// Override for tests. Normally taken from the signed-in role.
  final bool? isCaregiver;
  final VoidCallback? onExit;
  const StoryWorkflowScreen({super.key, this.isCaregiver, this.onExit});

  @override
  ConsumerState<StoryWorkflowScreen> createState() => _StoryWorkflowScreenState();
}

class _StoryWorkflowScreenState extends ConsumerState<StoryWorkflowScreen> {
  final List<Story> _stories = <Story>[];
  final TextEditingController _title = TextEditingController();
  final TextEditingController _body = TextEditingController();
  final TextEditingController _reason = TextEditingController();
  String? _error;
  Story? _reading;
  String? _rejectingId;
  int _counter = 1;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    _reason.dispose();
    super.dispose();
  }

  bool _apply(String id, TransitionResult r) {
    if (!r.ok) {
      setState(() => _error = r.error);
      return false;
    }
    setState(() {
      _error = null;
      final int i = _stories.indexWhere((s) => s.id == id);
      if (i >= 0) _stories[i] = r.story!;
    });
    return true;
  }

  void _saveDraft() {
    final List<String> issues = validateStory(_title.text, _body.text);
    if (issues.isNotEmpty) {
      setState(() => _error = issues.first);
      return;
    }
    setState(() {
      _stories.add(createDraft('story-$_counter', _title.text, _body.text));
      _counter++;
      _title.clear();
      _body.clear();
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final LowSensoryInfo sensory = watchLowSensory(context, ref);
    final bool caregiver = widget.isCaregiver ?? (ref.watch(authProvider).role == 'caregiver');
    final VoidCallback exit = widget.onExit ?? () => defaultCalmToolExit(context);

    if (!caregiver) {
      return CalmToolScaffold(
        title: 'Story workflow',
        lowSensory: sensory.lowSensory,
        notice: sensory.notice,
        onExit: exit,
        child: const Card(
          child: Padding(
            padding: EdgeInsets.all(20),
            child: Text('Writing and approving stories is for caregivers. Please ask the caregiver who looks after you.'),
          ),
        ),
      );
    }

    if (_reading != null) {
      return CalmToolScaffold(
        title: _reading!.title,
        lowSensory: sensory.lowSensory,
        notice: sensory.notice,
        onExit: exit,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(_reading!.body, style: const TextStyle(fontSize: 18, height: 1.5)),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: () => setState(() => _reading = null),
                  child: const Text('Back to stories'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return CalmToolScaffold(
      title: 'Story workflow',
      lowSensory: sensory.lowSensory,
      notice: sensory.notice,
      onExit: exit,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const Text(
            'Prototype: stories are kept only while this screen is open and are not saved yet. The checks here are basic and the wording still needs human review.',
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  const Text('Write a draft', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _title,
                    decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _body,
                    minLines: 5,
                    maxLines: 8,
                    decoration: const InputDecoration(labelText: 'Story', border: OutlineInputBorder()),
                  ),
                  if (_error != null) ...<Widget>[
                    const SizedBox(height: 8),
                    Semantics(
                      liveRegion: true,
                      child: Text(_error!, style: const TextStyle(color: Color(0xFFB00020))),
                    ),
                  ],
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _saveDraft, child: const Text('Save draft')),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text('Your stories', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (_stories.isEmpty) const Text('No stories yet. Write a draft above.'),
          for (final Story s in _stories)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(s.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                    Text(statusLabel(s.status), style: const TextStyle(color: Colors.black54)),
                    if (s.status == StoryStatus.rejected && s.rejectionReason != null)
                      Text('Reason: ${s.rejectionReason}'),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: <Widget>[
                        if (s.status == StoryStatus.draft || s.status == StoryStatus.rejected)
                          FilledButton(
                            onPressed: () => _apply(s.id, submitForApproval(s)),
                            child: const Text('Send for approval'),
                          ),
                        if (s.status == StoryStatus.pendingApproval) ...<Widget>[
                          FilledButton(
                            onPressed: () => _apply(s.id, approveStory(s, caregiver)),
                            child: const Text('Approve'),
                          ),
                          OutlinedButton(
                            onPressed: () => setState(() => _rejectingId = _rejectingId == s.id ? null : s.id),
                            child: const Text('Ask for changes'),
                          ),
                        ],
                        if (canRead(s))
                          FilledButton(
                            onPressed: () => setState(() => _reading = s),
                            child: const Text('Read story'),
                          ),
                      ],
                    ),
                    if (_rejectingId == s.id) ...<Widget>[
                      const SizedBox(height: 8),
                      TextField(
                        controller: _reason,
                        decoration: const InputDecoration(labelText: 'What should change?', border: OutlineInputBorder()),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: () {
                          if (_apply(s.id, rejectStory(s, caregiver, _reason.text))) {
                            setState(() {
                              _rejectingId = null;
                              _reason.clear();
                            });
                          }
                        },
                        child: const Text('Send feedback'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
