import 'package:flutter/material.dart';

/// Auth screen — sign up or log in. See architecture spec section 2.
///
/// Sign up flow: create caregiver account -> add child profile
/// (name, age, assigned modules) -> set child PIN/pattern.
/// Log in flow: validate credentials -> receive session token.
/// Both paths converge on the same token format handed back to Home page.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isSignUp = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_isSignUp ? 'Create your account' : 'Welcome back',
                    style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 24),
                // TODO: email + password fields
                // TODO: on sign up success -> add child profile form -> set PIN
                // TODO: on log in success -> store token -> go to /dashboard
                TextButton(
                  onPressed: () => setState(() => _isSignUp = !_isSignUp),
                  child: Text(_isSignUp ? 'Already have an account? Log in' : 'New here? Sign up'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
