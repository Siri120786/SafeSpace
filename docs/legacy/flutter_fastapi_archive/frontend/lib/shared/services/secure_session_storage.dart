import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Wraps flutter_secure_storage for the one thing Home page is allowed to
/// do client-side: read/write a session token. No validation logic lives
/// here — that's the Auth service's job. See architecture spec section 2.
class SecureSessionStorage {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'safespace_session_token';

  static Future<void> saveToken(String token) => _storage.write(key: _tokenKey, value: token);

  static Future<String?> readToken() => _storage.read(key: _tokenKey);

  static Future<void> clearToken() => _storage.delete(key: _tokenKey);
}
