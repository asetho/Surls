import Foundation

struct SiteProfile: Codable, Identifiable, Equatable, Sendable {
    var id: UUID
    var name: String
    var baseURL: String
    var isDefault: Bool

    init(id: UUID = UUID(), name: String, baseURL: String, isDefault: Bool = false) {
        self.id = id
        self.name = name
        self.baseURL = baseURL
        self.isDefault = isDefault
    }

    var uploadURL: URL? {
        URL(string: baseURL)?.appending(path: "api/uploads")
    }

    static func normalizedBaseURL(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard var components = URLComponents(string: trimmed),
              let scheme = components.scheme?.lowercased(),
              let host = components.host,
              !host.isEmpty,
              scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host)) else {
            return nil
        }
        components.path = components.path.replacingOccurrences(of: #"/+$"#, with: "", options: .regularExpression)
        components.query = nil
        components.fragment = nil
        return components.url?.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
}
