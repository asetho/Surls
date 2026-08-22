import Foundation

enum UploadLimit: Equatable {
    static let responseHeader = "X-Surls-Upload-Max-Bytes"

    case unknown
    case unlimited
    case bytes(Int64)

    init(response: HTTPURLResponse?) {
        guard let rawValue = response?.value(forHTTPHeaderField: Self.responseHeader) else {
            self = .unknown
            return
        }
        if rawValue.lowercased() == "unlimited" {
            self = .unlimited
        } else if let bytes = Int64(rawValue), bytes > 0 {
            self = .bytes(bytes)
        } else {
            self = .unknown
        }
    }

    var connectionDescription: String {
        switch self {
        case .unknown: "Connection successful"
        case .unlimited: "Connection successful · no upload limit"
        case .bytes(let bytes): "Connection successful · \(Self.fileSizeLabel(bytes)) limit"
        }
    }

    func rejectionMessage(fileBytes: Int) -> String? {
        guard case .bytes(let maximum) = self, Int64(fileBytes) > maximum else { return nil }
        return "This user can upload files up to \(Self.fileSizeLabel(maximum)). The selected file is \(Self.fileSizeLabel(Int64(fileBytes)))."
    }

    private static func fileSizeLabel(_ bytes: Int64) -> String {
        let gigabyte: Int64 = 1024 * 1024 * 1024
        let megabyte: Int64 = 1024 * 1024
        let kilobyte: Int64 = 1024
        if bytes >= gigabyte, bytes.isMultiple(of: gigabyte) { return "\(bytes / gigabyte) GB" }
        if bytes >= megabyte { return "\(bytes / megabyte) MB" }
        if bytes >= kilobyte { return "\(bytes / kilobyte) KB" }
        return "\(bytes) bytes"
    }
}
