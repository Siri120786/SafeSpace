import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../features/auth/auth_provider.dart';
import '../features/profile/models/profile_preferences.dart';
import '../features/profile/services/profile_service.dart';

class SupportAreaOption {
  final String key;
  final String label;
  final String desc;
  final String icon;

  const SupportAreaOption({
    required this.key,
    required this.label,
    required this.desc,
    required this.icon,
  });
}

const List<SupportAreaOption> supportOptions = [
  SupportAreaOption(
    key: 'anxiety',
    label: 'Anxiety Support',
    desc: 'Breathing, grounding & gentle reframing',
    icon: '🌱',
  ),
  SupportAreaOption(
    key: 'adhd',
    label: 'ADHD Support',
    desc: 'Micro-tasking, structure & focus timers',
    icon: '⚡',
  ),
  SupportAreaOption(
    key: 'autism',
    label: 'Autism Support',
    desc: 'Sensory ease, predictability & clarity',
    icon: '🧩',
  ),
  SupportAreaOption(
    key: 'depression',
    label: 'Depression Support',
    desc: 'Low-energy steps & gentle encouragement',
    icon: '🌤️',
  ),
  SupportAreaOption(
    key: 'ptsd',
    label: 'PTSD Support',
    desc: 'Grounding exercises & comforting routines',
    icon: '🛡️',
  ),
  SupportAreaOption(
    key: 'pcos_pcod',
    label: 'PCOS / PCOD Wellbeing',
    desc: 'Hormonal balance, rest & self-care',
    icon: '🌸',
  ),
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int currentStep = 1;
  final TextEditingController nameController = TextEditingController();

  List<String> selectedSupportAreas = [];
  bool reducedSensoryStimulation = false;
  bool largerText = false;
  bool readAloud = false;
  bool simplifiedPresentation = false;

  bool isLoading = true;
  bool isSubmitting = false;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    _loadPreferencesAndStep();
  }

  @override
  void dispose() {
    nameController.dispose();
    super.dispose();
  }

  Future<void> _loadPreferencesAndStep() async {
    final authState = ref.read(authProvider);
    final userId = authState.userId;

    if (userId == null) {
      setState(() => isLoading = false);
      return;
    }

    if (authState.displayName != null && authState.displayName!.isNotEmpty) {
      nameController.text = authState.displayName!;
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final savedStep = prefs.getInt('safespace_onboarding_step_$userId');
      if (savedStep != null && savedStep >= 1 && savedStep <= 4) {
        currentStep = savedStep;
      }

      final supp = await ProfileService.getSupportPreferences(userId);
      if (supp != null) {
        selectedSupportAreas = List.from(supp.supportAreas);
      }

      final acc = await ProfileService.getAccessibilityPreferences(userId);
      if (acc != null) {
        reducedSensoryStimulation = acc.reducedSensoryStimulation;
        largerText = acc.largerText;
        readAloud = acc.readAloud;
        simplifiedPresentation = acc.simplifiedPresentation;
      }
    } catch (_) {}

    if (mounted) {
      setState(() => isLoading = false);
    }
  }

  Future<void> _updateStep(int newStep) async {
    setState(() {
      currentStep = newStep;
      errorMessage = null;
    });

    final userId = ref.read(authProvider).userId;
    if (userId != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('safespace_onboarding_step_$userId', newStep);
    }
  }

  Future<void> _handleNext() async {
    setState(() => errorMessage = null);

    if (currentStep == 1 && nameController.text.trim().isEmpty) {
      setState(() => errorMessage = 'Please enter your display name to proceed.');
      return;
    }

    final userId = ref.read(authProvider).userId;

    // Intermediate save
    if (userId != null) {
      try {
        if (currentStep == 1) {
          await ProfileService.updateUserProfile(
            profileId: userId,
            displayName: nameController.text.trim(),
          );
        } else if (currentStep == 2) {
          await ProfileService.saveSupportPreferences(
            profileId: userId,
            supportAreas: selectedSupportAreas,
          );
        } else if (currentStep == 3) {
          await ProfileService.saveAccessibilityPreferences(
            profileId: userId,
            reducedSensoryStimulation: reducedSensoryStimulation,
            largerText: largerText,
            readAloud: readAloud,
            simplifiedPresentation: simplifiedPresentation,
          );
        }
      } catch (_) {}
    }

    if (currentStep < 4) {
      _updateStep(currentStep + 1);
    } else {
      _handleComplete();
    }
  }

  void _handleBack() {
    if (currentStep > 1) {
      _updateStep(currentStep - 1);
    }
  }

  Future<void> _handleComplete() async {
    final userId = ref.read(authProvider).userId;
    if (userId == null) return;

    setState(() {
      isSubmitting = true;
      errorMessage = null;
    });

    try {
      if (nameController.text.trim().isNotEmpty) {
        await ProfileService.updateUserProfile(
          profileId: userId,
          displayName: nameController.text.trim(),
        );
      }

      await ProfileService.saveSupportPreferences(
        profileId: userId,
        supportAreas: selectedSupportAreas,
      );

      await ProfileService.saveAccessibilityPreferences(
        profileId: userId,
        reducedSensoryStimulation: reducedSensoryStimulation,
        largerText: largerText,
        readAloud: readAloud,
        simplifiedPresentation: simplifiedPresentation,
      );

      await ProfileService.completeOnboarding(userId);

      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('safespace_onboarding_step_$userId');

      await ref.read(authProvider.notifier).initAuth();

      if (mounted) {
        context.go('/dashboard');
      }
    } catch (e) {
      setState(() {
        isSubmitting = false;
        errorMessage = 'Failed to complete setup: ${e.toString()}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Setup SafeSpace (Step $currentStep of 4)'),
        leading: currentStep > 1
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: _handleBack,
              )
            : null,
        actions: [
          TextButton(
            onPressed: _handleComplete,
            child: const Text('Skip'),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            children: [
              // Progress Bar
              LinearProgressIndicator(
                value: currentStep / 4.0,
                backgroundColor: Colors.grey.shade200,
                color: const Color(0xFF6C5CE7),
              ),
              const SizedBox(height: 20),

              if (errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(
                    errorMessage!,
                    style: TextStyle(color: Colors.red.shade800, fontSize: 13),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              Expanded(
                child: SingleChildScrollView(
                  child: _buildCurrentStepWidget(),
                ),
              ),

              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6C5CE7),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: isSubmitting ? null : _handleNext,
                  child: isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          currentStep == 4 ? 'Enter SafeSpace' : 'Continue',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentStepWidget() {
    switch (currentStep) {
      case 1:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'What should we call you?',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Enter your preferred name or nickname for SafeSpace.',
              style: TextStyle(color: Colors.grey, fontSize: 14),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: nameController,
              decoration: const InputDecoration(
                labelText: 'Display Name',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        );

      case 2:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'What would you like support with?',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Select support preferences to customize your tools. SafeSpace does not diagnose.',
              style: TextStyle(color: Colors.grey, fontSize: 14),
            ),
            const SizedBox(height: 20),
            ...supportOptions.map((opt) {
              final isSelected = selectedSupportAreas.contains(opt.key);
              return CheckboxListTile(
                value: isSelected,
                title: Text('${opt.icon} ${opt.label}'),
                subtitle: Text(opt.desc),
                activeColor: const Color(0xFF6C5CE7),
                onChanged: (val) {
                  setState(() {
                    if (val == true) {
                      selectedSupportAreas.add(opt.key);
                    } else {
                      selectedSupportAreas.remove(opt.key);
                    }
                  });
                },
              );
            }),
          ],
        );

      case 3:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Make SafeSpace comfortable for you',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Configure sensory and presentation accessibility preferences.',
              style: TextStyle(color: Colors.grey, fontSize: 14),
            ),
            const SizedBox(height: 20),
            SwitchListTile(
              title: const Text('Reduced Sensory Stimulation'),
              subtitle: const Text('Softened colors and reduced movement'),
              value: reducedSensoryStimulation,
              activeColor: const Color(0xFF6C5CE7),
              onChanged: (val) =>
                  setState(() => reducedSensoryStimulation = val),
            ),
            SwitchListTile(
              title: const Text('Larger Text'),
              subtitle: const Text('Increase typography sizing across screens'),
              value: largerText,
              activeColor: const Color(0xFF6C5CE7),
              onChanged: (val) => setState(() => largerText = val),
            ),
            SwitchListTile(
              title: const Text('Read Aloud Support'),
              subtitle: const Text('Audio spoken feedback where available'),
              value: readAloud,
              activeColor: const Color(0xFF6C5CE7),
              onChanged: (val) => setState(() => readAloud = val),
            ),
            SwitchListTile(
              title: const Text('Simplified Presentation'),
              subtitle: const Text('Focused layout with reduced noise'),
              value: simplifiedPresentation,
              activeColor: const Color(0xFF6C5CE7),
              onChanged: (val) => setState(() => simplifiedPresentation = val),
            ),
          ],
        );

      case 4:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'All set!',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Review your selections before entering your SafeSpace.',
              style: TextStyle(color: Colors.grey, fontSize: 14),
            ),
            const SizedBox(height: 24),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Name: ${nameController.text.trim().isEmpty ? "(Not set)" : nameController.text.trim()}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Selected Support Areas: ${selectedSupportAreas.length}',
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Accessibility Toggles: ${(reducedSensoryStimulation ? 1 : 0) + (largerText ? 1 : 0) + (readAloud ? 1 : 0) + (simplifiedPresentation ? 1 : 0)} active',
                    ),
                  ],
                ),
              ),
            ),
          ],
        );

      default:
        return const SizedBox.shrink();
    }
  }
}
