import 'package:flutter/material.dart';

/// Home page — session router ONLY. See architecture spec section 2.
///
/// On init: read a token from secure storage, forward it to the backend's
/// /auth endpoint for validation, then navigate based on the role it
/// returns. This screen must never contain its own role-decision logic —
/// see docs/Architecture_Specification.md, "golden rule" in section 1.
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    // TODO: read token from flutter_secure_storage
    // TODO: if found, POST it to /auth for validation + role claim
    // TODO: navigate to /auth (no session), /dashboard (caregiver),
    //       or trigger the PIN/pattern prompt -> /user (child)
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
