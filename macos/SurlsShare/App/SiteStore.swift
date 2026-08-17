import Foundation

@MainActor
final class SiteStore: ObservableObject {
    @Published private(set) var profiles: [SiteProfile] = SharedSiteStore.load()
    @Published var errorMessage: String?

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
            if let token, !token.isEmpty {
                try SiteTokenKeychain.save(token, for: profile.id)
            } else if try SiteTokenKeychain.load(for: profile.id) == nil {
                throw ValidationError(message: "Enter an API token for this site.")
            }
            try SharedSiteStore.save(updated)
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
