import Foundation

@MainActor
final class SiteStore: ObservableObject {
    @Published private(set) var profiles: [SiteProfile]
    @Published var errorMessage: String?

    init() {
        do {
            profiles = try SharedSiteStore.load()
            for profile in profiles {
                _ = try SiteTokenKeychain.load(for: profile.id)
            }
            if !profiles.isEmpty {
                try SiteTokenKeychain.deleteOrphans(keeping: Set(profiles.map(\.id)))
            }
        } catch {
            profiles = []
            errorMessage = error.localizedDescription
        }
    }

    func save(profile: SiteProfile, token: String?) {
        do {
            var updated = profiles
            if let index = updated.firstIndex(where: { $0.id == profile.id }) {
                updated[index] = profile
            } else {
                updated.append(profile)
            }
            if updated.count == 1 || profile.isDefault {
                updated = updated.map {
                    var value = $0
                    value.isDefault = value.id == profile.id
                    return value
                }
            }
            let previousToken = try SiteTokenKeychain.load(for: profile.id)
            let replacementToken = token.flatMap { $0.isEmpty ? nil : $0 }
            if replacementToken == nil && previousToken == nil {
                throw ValidationError(message: "Enter an API token for this site.")
            }
            if let replacementToken {
                try SiteTokenKeychain.save(replacementToken, for: profile.id)
            }
            do {
                try SharedSiteStore.save(updated)
            } catch {
                if replacementToken != nil {
                    if let previousToken {
                        try SiteTokenKeychain.save(previousToken, for: profile.id)
                    } else {
                        try SiteTokenKeychain.delete(for: profile.id)
                    }
                }
                throw error
            }
            profiles = updated
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func makeDefault(_ id: UUID) {
        do {
            let updated = profiles.map {
                var value = $0
                value.isDefault = value.id == id
                return value
            }
            try SharedSiteStore.save(updated)
            profiles = updated
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func delete(_ id: UUID) {
        do {
            var updated = profiles.filter { $0.id != id }
            if !updated.isEmpty && !updated.contains(where: \.isDefault) {
                updated[0].isDefault = true
            }
            try SiteTokenKeychain.delete(for: id)
            try SharedSiteStore.save(updated)
            profiles = updated
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ValidationError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
