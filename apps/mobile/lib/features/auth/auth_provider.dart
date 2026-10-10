import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;
import '../../services/supabase_service.dart';
import 'auth_state.dart';

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(AuthState.loading()) {
    initAuth();
  }

  Future<void> initAuth() async {
    try {
      final client = SupabaseService.client;
      final session = client.auth.currentSession;
      if (session != null && session.user != null) {
        await _fetchProfileAndSetAuthenticated(session.user.id, session.user.email ?? '');
      } else {
        state = AuthState.unauthenticated();
      }
    } catch (_) {
      state = AuthState.unauthenticated();
    }
  }

  Future<void> _fetchProfileAndSetAuthenticated(String userId, String email) async {
    try {
      final client = SupabaseService.client;
      final response = await client
          .from('profiles')
          .select('id, role, display_name, onboarding_state')
          .eq('id', userId)
          .maybeSingle();

      final role = (response != null && response['role'] != null)
          ? response['role'] as String
          : 'caregiver';
      final displayName = response?['display_name'] as String?;
      final onboardingState = (response != null && response['onboarding_state'] != null)
          ? response['onboarding_state'] as String
          : 'pending';

      state = AuthState.authenticated(
        userId: userId,
        email: email,
        role: role,
        displayName: displayName,
        onboardingState: onboardingState,
      );
    } catch (e) {
      state = AuthState.authenticated(
        userId: userId,
        email: email,
        role: 'caregiver',
        onboardingState: 'pending',
      );
    }
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String role,
    String? displayName,
  }) async {
    state = AuthState.loading();
    try {
      final client = SupabaseService.client;
      final response = await client.auth.signUp(
        email: email,
        password: password,
        data: {
          'role': role,
          'display_name': displayName ?? '',
        },
      );

      if (response.user != null) {
        await _fetchProfileAndSetAuthenticated(response.user!.id, response.user!.email ?? email);
      } else {
        state = AuthState.unauthenticated(error: 'Signup requires verification or failed.');
      }
    } catch (e) {
      state = AuthState.unauthenticated(error: e.toString());
      rethrow;
    }
  }

  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = AuthState.loading();
    try {
      final client = SupabaseService.client;
      final response = await client.auth.signInWithPassword(
        email: email,
        password: password,
      );

      if (response.user != null) {
        await _fetchProfileAndSetAuthenticated(response.user!.id, response.user!.email ?? email);
      } else {
        state = AuthState.unauthenticated(error: 'Invalid email or password.');
      }
    } catch (e) {
      state = AuthState.unauthenticated(error: e.toString());
      rethrow;
    }
  }

  Future<void> resetPassword(String email) async {
    try {
      final client = SupabaseService.client;
      await client.auth.resetPasswordForEmail(email);
    } catch (e) {
      state = AuthState.unauthenticated(error: e.toString());
      rethrow;
    }
  }

  Future<void> signOut() async {
    try {
      final client = SupabaseService.client;
      await client.auth.signOut();
    } finally {
      state = AuthState.unauthenticated();
    }
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
