import Foundation

enum SharedSiteStore {
    static let appGroup = "group.cc.aarn.surlsshare"
    private static let profilesKey = "siteProfiles"

    static func load() -> [SiteProfile] {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: profilesKey),
              let profiles = try? JSONDecoder().decode([SiteProfile].self, from: data) else {
            return []
        }
        return profiles
    }

    static func save(_ profiles: [SiteProfile]) throws {
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            throw CocoaError(.fileWriteUnknown)
        }
        defaults.set(try JSONEncoder().encode(profiles), forKey: profilesKey)
    }

    static var defaultSite: SiteProfile? {
        let profiles = load()
        return profiles.first(where: \.isDefault) ?? profiles.first
    }
}
