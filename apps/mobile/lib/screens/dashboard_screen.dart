import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../features/auth/auth_provider.dart';
import '../features/auth/auth_state.dart';
import 'caregiver_dashboard_screen.dart';
import 'user_dashboard_screen.dart';
import 'login_screen.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    if (authState.status == AuthStatus.loading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (authState.status != AuthStatus.authenticated) {
      return const LoginScreen();
    }

    if (authState.role == 'caregiver') {
      return const CaregiverDashboardScreen();
    }

    return const UserDashboardScreen();
  }
}
