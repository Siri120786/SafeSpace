enum AuthStatus { loading, authenticated, unauthenticated, error }

class AuthState {
  final AuthStatus status;
  final String? userId;
  final String? email;
  final String? role; // 'caregiver' | 'user'
  final String? displayName;
  final String onboardingState; // 'pending' | 'completed'
  final String? errorMessage;

  const AuthState({
    required this.status,
    this.userId,
    this.email,
    this.role,
    this.displayName,
    this.onboardingState = 'pending',
    this.errorMessage,
  });

  factory AuthState.loading() => const AuthState(status: AuthStatus.loading);

  factory AuthState.unauthenticated({String? error}) => AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: error,
      );

  factory AuthState.authenticated({
    required String userId,
    required String email,
    required String role,
    String? displayName,
    String onboardingState = 'pending',
  }) =>
      AuthState(
        status: AuthStatus.authenticated,
        userId: userId,
        email: email,
        role: role,
        displayName: displayName,
        onboardingState: onboardingState,
      );

  factory AuthState.error(String message) => AuthState(
        status: AuthStatus.error,
        errorMessage: message,
      );
}
