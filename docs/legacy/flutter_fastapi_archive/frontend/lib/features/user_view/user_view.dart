import 'package:flutter/material.dart';

/// User view — render-only. See architecture spec section 4.
///
/// After PIN/pattern verification: load the child's assigned condition
/// module(s), branch on the count (0 = unresolved edge case, see spec
/// section 8 item 1; 1 = open module home directly; 2+ = show a picker),
/// then apply accessibility settings (low-sensory mode, theming) on render.
class UserView extends StatefulWidget {
  const UserView({super.key});

  @override
  State<UserView> createState() => _UserViewState();
}

class _UserViewState extends State<UserView> {
  List<String> _assignedModules = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadModules();
  }

  Future<void> _loadModules() async {
    // TODO: GET /modules/child/{child_id}
    // TODO: apply accessibility settings (low-sensory mode, theming) from the response
    setState(() {
      _assignedModules = ['autism']; // STUB
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_assignedModules.isEmpty) {
      // Open question — architecture spec section 8, item 1. No fallback
      // design agreed yet; this is a placeholder, not a final answer.
      return const Scaffold(
        body: Center(child: Text('No spaces set up yet — ask your caregiver.')),
      );
    }
    if (_assignedModules.length == 1) {
      // TODO: navigate straight into that module's home screen, skipping the picker.
      return Scaffold(body: Center(child: Text('Opening ${_assignedModules.first} module...')));
    }
    // TODO: render the picker — one friendly-named card per module (e.g. "Calm space").
    return Scaffold(
      body: ListView(
        children: _assignedModules.map((m) => ListTile(title: Text(m))).toList(),
      ),
    );
  }
}
