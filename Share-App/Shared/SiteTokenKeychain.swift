import Foundation
import Security

enum SharedKeychain {
    private static let accessGroupInfoKey = "SurlsKeychainAccessGroup"

    static func load(service: String, account: String) throws -> Data? {
        var query = try baseQuery(service: service, account: account)
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnData as String] = true

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else {
            throw KeychainError(status: status)
        }
        return data
    }

    static func save(_ data: Data, service: String, account: String) throws {
        let baseQuery = try baseQuery(service: service, account: account)
        SecItemDelete(baseQuery as CFDictionary)

        var query = baseQuery
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError(status: status) }
    }

    static func delete(service: String, account: String) throws {
        let status = SecItemDelete(try baseQuery(service: service, account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError(status: status)
        }
    }

    static func accounts(service: String) throws -> [String] {
        var query = try baseQuery(service: service)
        query[kSecMatchLimit as String] = kSecMatchLimitAll
        query[kSecReturnAttributes as String] = true

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return [] }
        guard status == errSecSuccess else { throw KeychainError(status: status) }

        let attributes: [[String: Any]]
        if let values = item as? [[String: Any]] {
            attributes = values
        } else if let value = item as? [String: Any] {
            attributes = [value]
        } else {
            return []
        }
        return attributes.compactMap { $0[kSecAttrAccount as String] as? String }
    }

    private static func baseQuery(service: String, account: String? = nil) throws -> [String: Any] {
        guard let accessGroup = Bundle.main.object(forInfoDictionaryKey: accessGroupInfoKey) as? String,
              !accessGroup.isEmpty,
              !accessGroup.contains("$(") else {
            throw SharedKeychainConfigurationError()
        }
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccessGroup as String: accessGroup
        ]
        if let account {
            query[kSecAttrAccount as String] = account
        }
        return query
    }
}

enum SiteTokenKeychain {
    private static let service = "cc.aarn.SurlsShare.site-token"

    static func save(_ token: String, for siteID: UUID) throws {
        try SharedKeychain.save(Data(token.utf8), service: service, account: siteID.uuidString)
    }

    static func load(for siteID: UUID) throws -> String? {
        if let data = try SharedKeychain.load(service: service, account: siteID.uuidString) {
            return String(data: data, encoding: .utf8)
        }
        guard let legacyToken = try loadLegacy(for: siteID) else { return nil }
        try SharedKeychain.save(Data(legacyToken.utf8), service: service, account: siteID.uuidString)
        return legacyToken
    }

    static func delete(for siteID: UUID) throws {
        deleteLegacy(for: siteID)
        try SharedKeychain.delete(service: service, account: siteID.uuidString)
    }

    static func deleteOrphans(keeping siteIDs: Set<UUID>) throws {
        for account in try SharedKeychain.accounts(service: service) {
            guard let siteID = UUID(uuidString: account), !siteIDs.contains(siteID) else { continue }
            try SharedKeychain.delete(service: service, account: account)
        }
    }

    private static func loadLegacy(for siteID: UUID) throws -> String? {
        var query = legacyQuery(for: siteID)
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnData as String] = true
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw KeychainError(status: status) }
        return String(data: data, encoding: .utf8)
    }

    private static func deleteLegacy(for siteID: UUID) {
        SecItemDelete(legacyQuery(for: siteID) as CFDictionary)
    }

    private static func legacyQuery(for siteID: UUID) -> [String: Any] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: siteID.uuidString
        ]
        return query
    }
}

struct SharedKeychainConfigurationError: LocalizedError {
    var errorDescription: String? {
        "Surls Share is missing its shared keychain configuration. Reinstall the app and try again."
    }
}

struct KeychainError: LocalizedError {
    let status: OSStatus

    var errorDescription: String? {
        SecCopyErrorMessageString(status, nil) as String? ?? "Keychain error \(status)"
    }
}
