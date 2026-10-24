import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class _GamesTile extends StatelessWidget {
  const _GamesTile();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Text('🎲', style: TextStyle(fontSize: 26)),
        title: const Text('Games'),
        subtitle: const Text('Memory, patterns, feelings, creating and mazes.'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/games'),
      ),
    );
  }
}

class ChildHomeScreen extends StatelessWidget {
  const ChildHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My SafeSpace'),
        actions: [
          IconButton(
            icon: const Icon(Icons.exit_to_app),
            onPressed: () => context.go('/'),
          ),
        ],
      ),
      body: const SafeArea(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Hello!',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Text(
                'Explore your space, check your routine, or write in your journal.',
                style: TextStyle(fontSize: 16, color: Colors.grey),
              ),
              SizedBox(height: 24),
              Card(
                child: ListTile(
                  leading: Icon(Icons.favorite, color: Color(0xFF00CEC9)),
                  title: Text('My Space'),
                  subtitle: Text('Sensory preferences & calming activities.'),
                ),
              ),
              _GamesTile(),
            ],
          ),
        ),
      ),
    );
  }
}
