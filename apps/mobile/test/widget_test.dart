import 'package:flutter_test/flutter_test.dart';
import 'package:safespace_mobile/main.dart';

void main() {
  testWidgets('SafeSpace app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const SafeSpaceApp());
    expect(find.text('SafeSpace'), findsOneWidget);
  });
}
