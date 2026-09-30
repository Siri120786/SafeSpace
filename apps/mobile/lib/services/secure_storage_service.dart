import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/constants.dart';

class SecureStorageService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<void> saveChildSessionToken(String token) async {
    await _storage.write(key: AppConstants.childTokenKey, value: token);
  }

  Future<String?> getChildSessionToken() async {
    return await _storage.read(key: AppConstants.childTokenKey);
  }

  Future<void> clearChildSessionToken() async {
    await _storage.delete(key: AppConstants.childTokenKey);
  }
}
