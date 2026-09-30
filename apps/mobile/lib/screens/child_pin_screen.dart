import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ChildPinScreen extends StatefulWidget {
  const ChildPinScreen({super.key});

  @override
  State<ChildPinScreen> createState() => _ChildPinScreenState();
}

class _ChildPinScreenState extends State<ChildPinScreen> {
  final _familyCodeController = TextEditingController();
  final _pinController = TextEditingController();

  @override
  void dispose() {
    _familyCodeController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  void _handleVerifyPin() {
    // Structural navigation foundation - will verify via verify-child-pin Edge Function
    context.go('/child-home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Child Login'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Enter Your PIN',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter your 6-character family code and 4-digit PIN.',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _familyCodeController,
                decoration: const InputDecoration(
                  labelText: 'Family Code (6 characters)',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.characters,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _pinController,
                decoration: const InputDecoration(
                  labelText: '4-Digit PIN',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.all(16),
                  backgroundColor: const Color(0xFF00CEC9),
                  foregroundColor: Colors.white,
                ),
                onPressed: _handleVerifyPin,
                child: const Text('Enter SafeSpace'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
