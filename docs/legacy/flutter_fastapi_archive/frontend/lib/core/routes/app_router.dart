import 'package:go_router/go_router.dart';
import '../../features/home/home_page.dart';
import '../../features/auth/auth_screen.dart';
import '../../features/caregiver_dashboard/caregiver_dashboard.dart';
import '../../features/user_view/user_view.dart';

/// Route structure mirrors the session-routing logic in
/// docs/Architecture_Specification.md section 2. The client only renders —
/// WHICH route to show is decided by the backend's role claim, never here.
class AppRouter {
  static final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (context, state) => const HomePage()),
      GoRoute(path: '/auth', builder: (context, state) => const AuthScreen()),
      GoRoute(path: '/dashboard', builder: (context, state) => const CaregiverDashboard()),
      GoRoute(path: '/user', builder: (context, state) => const UserView()),
    ],
  );
}
