import 'package:flutter/material.dart';

/// Caregiver dashboard — render-only, same rule as every other screen.
/// See architecture spec section 3.
///
/// Two panes: All-inputs view (aggregated, filtered server-side by privacy
/// tier BEFORE this screen ever sees it) and Settings (routine planning +
/// alerts). Default landing tab is All-inputs; Settings loads on demand.
class CaregiverDashboard extends StatefulWidget {
  const CaregiverDashboard({super.key});

  @override
  State<CaregiverDashboard> createState() => _CaregiverDashboardState();
}

class _CaregiverDashboardState extends State<CaregiverDashboard> {
  @override
  void initState() {
    super.initState();
    // TODO: 1. confirm caregiver session
    // TODO: 2. check linked children -> show profile selector if more than one
    // TODO: 3. GET /modules/dashboard/{child_id} -> already privacy-filtered
    // TODO: 4. render All-inputs view as the default tab
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Dashboard'),
          bottom: const TabBar(tabs: [Tab(text: 'All inputs'), Tab(text: 'Settings')]),
        ),
        body: const TabBarView(
          children: [
            Center(child: Text('All-inputs view — TODO: render fetched, filtered data')),
            Center(child: Text('Settings — TODO: routine planning + alert preferences')),
          ],
        ),
      ),
    );
  }
}
