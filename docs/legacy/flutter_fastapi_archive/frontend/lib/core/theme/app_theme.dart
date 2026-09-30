import 'package:flutter/material.dart';

/// Central theme definitions.
///
/// TODO: add a low-sensory ThemeData variant — reduced animation duration,
/// muted saturation, disabled auto-playing transitions. See architecture
/// spec section 4 (User view accessibility settings) for the requirement
/// this exists to satisfy. It must be read from the child's profile and
/// applied on render, never toggled by default client-side logic.
class AppTheme {
  static ThemeData get light => ThemeData(
        brightness: Brightness.light,
        colorSchemeSeed: const Color(0xFF5B4FC7),
        useMaterial3: true,
      );

  static ThemeData get dark => ThemeData(
        brightness: Brightness.dark,
        colorSchemeSeed: const Color(0xFF5B4FC7),
        useMaterial3: true,
      );
}
