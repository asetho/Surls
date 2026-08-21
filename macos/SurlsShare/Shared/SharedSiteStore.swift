import Foundation

enum SharedSiteStore {
    static let appGroup = "group.cc.aarn.surlsshare"
    private static let profilesKey = "siteProfiles"
    private static let keychainService = "cc.aarn.SurlsShare.site-profiles"
    private static let keychainAccount = "profiles"

    static func load() throws -> [SiteProfile] {
        if let data = try SharedKeychain.load(service: keychainService, account: keychainAccount) {
            return try JSONDecoder().decode([SiteProfile].self, from: data)
        }

        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: profilesKey) else { return [] }
        let profiles = try JSONDecoder().decode([SiteProfile].self, from: data)
        try SharedKeychain.save(data, service: keychainService, account: keychainAccount)
        return profiles
    }

    static func save(_ profiles: [SiteProfile]) throws {
        let data = try JSONEncoder().encode(profiles)
        try SharedKeychain.save(data, service: keychainService, account: keychainAccount)
        if let defaults = UserDefaults(suiteName: appGroup) {
            defaults.set(data, forKey: profilesKey)
        }
    }

    static func defaultSite() throws -> SiteProfile? {
        let profiles = try load()
        return profiles.first(where: \.isDefault) ?? profiles.first
    }
}
