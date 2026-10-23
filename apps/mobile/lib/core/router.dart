import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../screens/role_choice_screen.dart';
import '../screens/login_screen.dart';
import '../screens/signup_screen.dart';
import '../screens/forgot_password_screen.dart';
import '../screens/child_pin_screen.dart';
import '../screens/dashboard_screen.dart';
import '../screens/caregiver_dashboard_screen.dart';
import '../screens/user_dashboard_screen.dart';
import '../screens/child_home_screen.dart';
import '../screens/onboarding_screen.dart';
import '../screens/profile_screen.dart';
import '../features/calm_tools/calm_tools_feature.dart';
import '../features/mood/screens/mood_check_in_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  routes: <RouteBase>[
    GoRoute(
      path: '/',
      builder: (BuildContext context, GoRouterState state) {
        return const RoleChoiceScreen();
      },
    ),
    GoRoute(
      path: '/login',
      builder: (BuildContext context, GoRouterState state) {
        return const LoginScreen();
      },
    ),
    GoRoute(
      path: '/signup',
      builder: (BuildContext context, GoRouterState state) {
        return const SignupScreen();
      },
    ),
    GoRoute(
      path: '/forgot-password',
      builder: (BuildContext context, GoRouterState state) {
        return const ForgotPasswordScreen();
      },
    ),
    GoRoute(
      path: '/caregiver-auth',
      builder: (BuildContext context, GoRouterState state) {
        return const LoginScreen();
      },
    ),
    GoRoute(
      path: '/child-pin',
      builder: (BuildContext context, GoRouterState state) {
        return const ChildPinScreen();
      },
    ),
    GoRoute(
      path: '/onboarding',
      builder: (BuildContext context, GoRouterState state) {
        return const OnboardingScreen();
      },
    ),
    GoRoute(
      path: '/profile',
      builder: (BuildContext context, GoRouterState state) {
        return const ProfileScreen();
      },
    ),
    GoRoute(
      path: '/calm-tools',
      builder: (BuildContext context, GoRouterState state) {
        return const CalmToolsScreen();
      },
      routes: <RouteBase>[
        GoRoute(
          path: 'breathing',
          builder: (BuildContext context, GoRouterState state) {
            return const BreathingScreen();
          },
        ),
        GoRoute(
          path: 'grounding',
          builder: (BuildContext context, GoRouterState state) {
            return const GroundingScreen();
          },
        ),
      ],
    ),
    GoRoute(
      path: '/dashboard',
      builder: (BuildContext context, GoRouterState state) {
        return const DashboardScreen();
      },
    ),
    GoRoute(
      path: '/caregiver-dashboard',
      builder: (BuildContext context, GoRouterState state) {
        return const CaregiverDashboardScreen();
      },
    ),
    GoRoute(
      path: '/user-dashboard',
      builder: (BuildContext context, GoRouterState state) {
        return const UserDashboardScreen();
      },
    ),
    GoRoute(
      path: '/child-home',
      builder: (BuildContext context, GoRouterState state) {
        return const ChildHomeScreen();
      },
    ),
    GoRoute(
      path: '/mood-check-in',
      builder: (BuildContext context, GoRouterState state) {
        return const MoodCheckInScreen();
      },
    ),
  ],
);
