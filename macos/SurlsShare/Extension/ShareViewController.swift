import AppKit
import UniformTypeIdentifiers

final class ShareViewController: NSViewController {
    private let statusLabel = NSTextField(labelWithString: "Preparing upload…")
    private let detailLabel = NSTextField(wrappingLabelWithString: "")
    private let progress = NSProgressIndicator()
    private let closeButton = NSButton(title: "Close", target: nil, action: nil)
    private let retryButton = NSButton(title: "Try Again", target: nil, action: nil)
    private var started = false

    override func loadView() {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false

        statusLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        detailLabel.textColor = .secondaryLabelColor
        detailLabel.maximumNumberOfLines = 3
        progress.style = .spinning
        progress.controlSize = .small
        closeButton.target = self
        closeButton.action = #selector(closeExtension)
        closeButton.isHidden = true
        retryButton.target = self
        retryButton.action = #selector(retry)
        retryButton.isHidden = true

        let header = NSStackView(views: [progress, statusLabel])
        header.orientation = .horizontal
        header.alignment = .centerY
        header.spacing = 10

        let buttons = NSStackView(views: [retryButton, closeButton])
        buttons.orientation = .horizontal
        buttons.alignment = .centerY
        buttons.spacing = 8

        let stack = NSStackView(views: [header, detailLabel, buttons])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -22),
            stack.topAnchor.constraint(equalTo: container.topAnchor, constant: 20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: container.bottomAnchor, constant: -20),
            buttons.trailingAnchor.constraint(equalTo: stack.trailingAnchor)
        ])
        view = container
        preferredContentSize = NSSize(width: 420, height: 145)
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        guard !started else { return }
        started = true
        beginUpload()
    }

    private func beginUpload() {
        closeButton.isHidden = true
        retryButton.isHidden = true
        progress.isHidden = false
        progress.startAnimation(nil)

        guard let site = SharedSiteStore.defaultSite else {
            showFailure("Open Surls Share and add a site first.")
            return
        }
        guard let token = try? SiteTokenKeychain.load(for: site.id), !token.isEmpty else {
            showFailure("The API token for \(site.name) is missing. Open Surls Share to add it again.")
            return
        }
        guard let provider = firstFileProvider() else {
            showFailure("No file was included in this share.")
            return
        }

        statusLabel.stringValue = "Uploading to \(site.name)…"
        detailLabel.stringValue = provider.suggestedName ?? "Shared file"
        loadFile(from: provider) { [weak self] result in
            switch result {
            case .success(let file): self?.upload(file, to: site, token: token)
            case .failure(let error): self?.showFailure(error.localizedDescription)
            }
        }
    }

    private func firstFileProvider() -> NSItemProvider? {
        (extensionContext?.inputItems as? [NSExtensionItem])?
            .flatMap { $0.attachments ?? [] }
            .first
    }

    private func loadFile(from provider: NSItemProvider, completion: @escaping (Result<SharedFile, Error>) -> Void) {
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, error in
                if let error { return DispatchQueue.main.async { completion(.failure(error)) } }
                let url = (item as? URL) ?? (item as? NSURL).map { $0 as URL }
                guard let url else {
                    return DispatchQueue.main.async { completion(.failure(ShareError("Couldn’t read the shared file."))) }
                }
                DispatchQueue.global(qos: .userInitiated).async {
                    let result = Result { try SharedFile(url: url) }
                    DispatchQueue.main.async { completion(result) }
                }
            }
            return
        }

        guard let typeIdentifier = provider.registeredTypeIdentifiers.first(where: {
            UTType($0)?.conforms(to: .data) == true
        }) else {
            completion(.failure(ShareError("This shared item isn’t a file.")))
            return
        }
        provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { url, error in
            if let error { return DispatchQueue.main.async { completion(.failure(error)) } }
            guard let url else {
                return DispatchQueue.main.async { completion(.failure(ShareError("Couldn’t load the shared file."))) }
            }
            let result = Result {
                try SharedFile(url: url, suggestedName: provider.suggestedName, typeIdentifier: typeIdentifier)
            }
            DispatchQueue.main.async { completion(result) }
        }
    }

    private func upload(_ file: SharedFile, to site: SiteProfile, token: String) {
        guard let url = site.uploadURL else {
            showFailure("The saved URL for \(site.name) is invalid.")
            return
        }
        let boundary = "SurlsBoundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 120
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = MultipartBody(boundary: boundary)
            .field(name: "filenameMode", value: "safe")
            .field(name: "title", value: file.name)
            .file(name: "file", filename: file.name, mimeType: file.mimeType, data: file.data)
            .finish()

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error {
                    self?.showFailure(error.localizedDescription)
                    return
                }
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                let payload = data.flatMap { try? JSONDecoder().decode(UploadResponse.self, from: $0) }
                guard status == 201, let shortURL = payload?.shortUrl else {
                    self?.showFailure(payload?.error ?? "Surls returned HTTP \(status).")
                    return
                }
                self?.copyAndFinish(shortURL, siteName: site.name)
            }
        }.resume()
    }

    private func copyAndFinish(_ shortURL: String, siteName: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(shortURL, forType: .string)
        progress.stopAnimation(nil)
        progress.isHidden = true
        statusLabel.stringValue = "Short URL copied"
        detailLabel.stringValue = "\(shortURL)\nUploaded with \(siteName)."
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        }
    }

    private func showFailure(_ message: String) {
        progress.stopAnimation(nil)
        progress.isHidden = true
        statusLabel.stringValue = "Upload failed"
        detailLabel.stringValue = message
        closeButton.isHidden = false
        retryButton.isHidden = false
    }

    @objc private func closeExtension() {
        extensionContext?.cancelRequest(withError: ShareError("Upload cancelled."))
    }

    @objc private func retry() {
        beginUpload()
    }
}

private struct SharedFile {
    let data: Data
    let name: String
    let mimeType: String

    init(url: URL, suggestedName: String? = nil, typeIdentifier: String? = nil) throws {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        data = try Data(contentsOf: url, options: .mappedIfSafe)
        name = suggestedName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? url.lastPathComponent
        let type = typeIdentifier.flatMap(UTType.init) ?? UTType(filenameExtension: url.pathExtension)
        mimeType = type?.preferredMIMEType ?? "application/octet-stream"
    }
}

private struct UploadResponse: Decodable {
    let shortUrl: String?
    let error: String?
}

private struct ShareError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

private struct MultipartBody {
    private let boundary: String
    private var data = Data()

    init(boundary: String) { self.boundary = boundary }

    func field(name: String, value: String) -> MultipartBody {
        var copy = self
        copy.append("--\(boundary)\r\n")
        copy.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
        copy.append("\(value)\r\n")
        return copy
    }

    func file(name: String, filename: String, mimeType: String, data fileData: Data) -> MultipartBody {
        var copy = self
        let safeFilename = filename.replacingOccurrences(of: "\\", with: "_").replacingOccurrences(of: "\"", with: "_")
        copy.append("--\(boundary)\r\n")
        copy.append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(safeFilename)\"\r\n")
        copy.append("Content-Type: \(mimeType)\r\n\r\n")
        copy.data.append(fileData)
        copy.append("\r\n")
        return copy
    }

    func finish() -> Data {
        var copy = self
        copy.append("--\(boundary)--\r\n")
        return copy.data
    }

    private mutating func append(_ string: String) {
        data.append(Data(string.utf8))
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
