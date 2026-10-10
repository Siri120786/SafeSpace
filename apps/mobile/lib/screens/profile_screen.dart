import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/auth_provider.dart';
import '../features/profile/services/profile_service.dart';
import 'onboarding_screen.dart' show supportOptions;

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final TextEditingController nameController = TextEditingController();

  List<String> selectedSupportAreas = [];
  bool reducedSensoryStimulation = false;
  bool largerText = false;
  bool readAloud = false;
  bool simplifiedPresentation = false;

  bool isLoading = true;
  bool isSaving = false;
  String? errorMessage;
  String? successMessage;

  @override
  void initState() {
    super.initState();
    _loadProfileData();
  }

  @override
  void dispose() {
    nameController.dispose();
    super.dispose();
  }

  Future<void> _loadProfileData() async {
    final authState = ref.read(authProvider);
    final userId = authState.userId;

    if (userId == null) {
      setState(() => isLoading = false);
      return;
    }

    if (authState.displayName != null) {
      nameController.text = authState.displayName!;
    }

    try {
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

  Future<void> _handleSave() async {
    final authState = ref.read(authProvider);
    final userId = authState.userId;

    if (userId == null) return;

    if (nameController.text.trim().isEmpty) {
      setState(() {
        errorMessage = 'Display name cannot be empty.';
        successMessage = null;
      });
      return;
    }

    setState(() {
      isSaving = true;
      errorMessage = null;
      successMessage = null;
    });

    try {
      await ProfileService.updateUserProfile(
        profileId: userId,
        displayName: nameController.text.trim(),
      );

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

      await ref.read(authProvider.notifier).initAuth();

      setState(() {
        isSaving = false;
        successMessage = 'Profile and preferences updated successfully!';
      });
    } catch (e) {
      setState(() {
        isSaving = false;
        errorMessage = 'Failed to save changes: ${e.toString()}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile & Preferences'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/dashboard');
            }
          },
        ),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (errorMessage != null) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Text(
                          errorMessage!,
                          style: TextStyle(color: Colors.red.shade800),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    if (successMessage != null) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.green.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.green.shade200),
                        ),
                        child: Text(
                          successMessage!,
                          style: TextStyle(color: Colors.green.shade800),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Section 1: Identity
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'User Identity',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: nameController,
                              decoration: const InputDecoration(
                                labelText: 'Display Name',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Text('Role: ${authState.role?.toUpperCase() ?? "USER"}'),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Section 2: Support Preferences
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Support Preferences',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Selections adapt assistance tools — these are support preferences, not diagnoses.',
                              style: TextStyle(color: Colors.grey, fontSize: 13),
                            ),
                            const SizedBox(height: 12),
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
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Section 3: Accessibility
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Accessibility Preferences',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 12),
                            SwitchListTile(
                              title: const Text('Reduced Sensory Stimulation'),
                              subtitle: const Text('Softened visual palette and reduced motion'),
                              value: reducedSensoryStimulation,
                              activeColor: const Color(0xFF6C5CE7),
                              onChanged: (val) => setState(() => reducedSensoryStimulation = val),
                            ),
                            SwitchListTile(
                              title: const Text('Larger Text'),
                              subtitle: const Text('Increase typography size'),
                              value: largerText,
                              activeColor: const Color(0xFF6C5CE7),
                              onChanged: (val) => setState(() => largerText = val),
                            ),
                            SwitchListTile(
                              title: const Text('Read Aloud Support'),
                              subtitle: const Text('Spoken audio prompts'),
                              value: readAloud,
                              activeColor: const Color(0xFF6C5CE7),
                              onChanged: (val) => setState(() => readAloud = val),
                            ),
                            SwitchListTile(
                              title: const Text('Simplified Presentation'),
                              subtitle: const Text('Direct layout with low clutter'),
                              value: simplifiedPresentation,
                              activeColor: const Color(0xFF6C5CE7),
                              onChanged: (val) => setState(() => simplifiedPresentation = val),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

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
                        onPressed: isSaving ? null : _handleSave,
                        child: isSaving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                'Save Profile & Preferences',
                                style: TextStyle(
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
}
