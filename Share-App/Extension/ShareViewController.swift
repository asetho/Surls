import AppKit
import UniformTypeIdentifiers

final class ShareViewController: NSViewController, URLSessionTaskDelegate, NSTextFieldDelegate {
    private let statusLabel = NSTextField(labelWithString: "Preparing upload…")
    private let detailLabel = NSTextField(wrappingLabelWithString: "")
    private let progress = NSProgressIndicator()
    private let uploadProgress = NSProgressIndicator()
    private let uploadPercentLabel = NSTextField(labelWithString: "0%")
    private let uploadProgressContainer = NSStackView()
    private let sitePicker = NSPopUpButton(frame: .zero, pullsDown: false)
    private let keywordField = NSTextField()
    private let keywordStatusLabel = NSTextField(wrappingLabelWithString: "")
    private let keywordContainer = NSStackView()
    private let uploadButton = NSButton(title: "Upload", target: nil, action: nil)
    private let copyButton = NSButton(title: "Copy", target: nil, action: nil)
    private let closeButton = NSButton(title: "Close", target: nil, action: nil)
    private let retryButton = NSButton(title: "Try Again", target: nil, action: nil)
    private var sites: [SiteProfile] = []
    private var uploadSession: URLSession?
    private var uploadTask: URLSessionUploadTask?
    private var uploadAttempt: UUID?
    private var uploadBodyURL: URL?
    private var keywordCheckTask: URLSessionDataTask?
    private var keywordCheckWorkItem: DispatchWorkItem?
    private var keywordCheckAttempt: UUID?
    private var keywordIsValid = true
    private var uploadLimitTask: URLSessionDataTask?
    private var uploadLimitAttempt: UUID?
    private var fileLoadProgress: Progress?
    private var fileLoadTimeout: DispatchWorkItem?
    private var fileLoadAttempt: UUID?
    private var showingFailureAlert = false
    private var hasFailed = false
    private var generatedShortURL: String?
    private var started = false

    override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 420, height: 245))
        container.autoresizingMask = [.width, .height]

        statusLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        detailLabel.textColor = .secondaryLabelColor
        detailLabel.maximumNumberOfLines = 3
        progress.style = .spinning
        progress.controlSize = .small
        progress.isHidden = true
        uploadProgress.style = .bar
        uploadProgress.isIndeterminate = false
        uploadProgress.minValue = 0
        uploadProgress.maxValue = 100
        uploadProgress.doubleValue = 0
        uploadProgress.setContentHuggingPriority(.defaultLow, for: .horizontal)
        uploadPercentLabel.alignment = .right
        uploadPercentLabel.textColor = .secondaryLabelColor
        uploadPercentLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        uploadProgressContainer.orientation = .horizontal
        uploadProgressContainer.alignment = .centerY
        uploadProgressContainer.spacing = 8
        uploadProgressContainer.addArrangedSubview(uploadProgress)
        uploadProgressContainer.addArrangedSubview(uploadPercentLabel)
        uploadProgressContainer.isHidden = true
        sitePicker.setAccessibilityLabel("Destination site")
        sitePicker.target = self
        sitePicker.action = #selector(siteSelectionChanged)
        sitePicker.isHidden = true
        keywordField.placeholderString = "Short keyword (optional — blank for random)"
        keywordField.setAccessibilityLabel("Short keyword")
        keywordField.delegate = self
        keywordStatusLabel.font = .systemFont(ofSize: 11)
        keywordStatusLabel.maximumNumberOfLines = 2
        keywordStatusLabel.isHidden = true
        keywordContainer.orientation = .vertical
        keywordContainer.alignment = .width
        keywordContainer.spacing = 4
        keywordContainer.addArrangedSubview(keywordField)
        keywordContainer.addArrangedSubview(keywordStatusLabel)
        keywordContainer.isHidden = true
        uploadButton.target = self
        uploadButton.action = #selector(beginSelectedUpload)
        uploadButton.keyEquivalent = "\r"
        uploadButton.isHidden = true
        copyButton.target = self
        copyButton.action = #selector(copyGeneratedURL)
        copyButton.isHidden = true
        closeButton.target = self
        closeButton.action = #selector(closeExtension)
        closeButton.title = "Cancel"
        retryButton.target = self
        retryButton.action = #selector(retry)
        retryButton.isHidden = true

        let header = NSStackView(views: [progress, statusLabel])
        header.orientation = .horizontal
        header.alignment = .centerY
        header.spacing = 10

        let buttons = NSStackView(views: [retryButton, copyButton, closeButton, uploadButton])
        buttons.orientation = .horizontal
        buttons.alignment = .centerY
        buttons.spacing = 8

        let stack = NSStackView(views: [header, detailLabel, sitePicker, keywordContainer, uploadProgressContainer, buttons])
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
            sitePicker.widthAnchor.constraint(equalTo: stack.widthAnchor),
            keywordContainer.widthAnchor.constraint(equalTo: stack.widthAnchor),
            uploadProgressContainer.widthAnchor.constraint(equalTo: stack.widthAnchor),
            buttons.trailingAnchor.constraint(equalTo: stack.trailingAnchor)
        ])
        view = container
        preferredContentSize = NSSize(width: 420, height: 245)
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        guard !started else { return }
        started = true
        showSiteChooser()
    }

    private func showSiteChooser() {
        hasFailed = false
        generatedShortURL = nil
        let selectedSiteID = sites.indices.contains(sitePicker.indexOfSelectedItem)
            ? sites[sitePicker.indexOfSelectedItem].id
            : nil
        do {
            sites = try SharedSiteStore.load()
        } catch {
            showFailure(error.localizedDescription)
            return
        }
        guard !sites.isEmpty else {
            showFailure("Open Surls Share and add a site first.")
            return
        }
        guard let provider = firstFileProvider() else {
            showFailure("No file was included in this share.")
            return
        }

        sitePicker.removeAllItems()
        sites.forEach { site in
            sitePicker.addItem(withTitle: site.isDefault ? "\(site.name) (Default)" : site.name)
        }
        sitePicker.selectItem(at: selectedSiteID.flatMap { selectedID in
            sites.firstIndex { $0.id == selectedID }
        } ?? sites.firstIndex { $0.isDefault } ?? 0)
        statusLabel.stringValue = "Choose a Surls site"
        detailLabel.stringValue = provider.suggestedName ?? "Shared file"
        progress.stopAnimation(nil)
        progress.isHidden = true
        uploadProgressContainer.isHidden = true
        retryButton.isHidden = true
        copyButton.isHidden = true
        closeButton.title = "Cancel"
        closeButton.keyEquivalent = ""
        closeButton.isHidden = false
        sitePicker.isHidden = false
        keywordContainer.isHidden = false
        uploadButton.isHidden = false
        scheduleKeywordCheck()
    }

    private func beginUpload() {
        let requestedCode = keywordField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard requestedCode.isEmpty || keywordIsValid else {
            statusLabel.stringValue = "Choose an available short keyword"
            return
        }
        cancelKeywordCheck()
        uploadAttempt = nil
        uploadTask?.cancel()
        uploadSession?.invalidateAndCancel()
        uploadTask = nil
        uploadSession = nil
        removeUploadBody()
        cancelFileLoad()
        hasFailed = false
        generatedShortURL = nil
        closeButton.title = "Cancel"
        closeButton.keyEquivalent = ""
        closeButton.isHidden = false
        retryButton.isHidden = true
        copyButton.isHidden = true
        progress.isHidden = false
        progress.startAnimation(nil)
        uploadProgressContainer.isHidden = true
        sitePicker.isHidden = true
        keywordContainer.isHidden = true
        uploadButton.isHidden = true

        let selectedIndex = sitePicker.indexOfSelectedItem
        guard sites.indices.contains(selectedIndex) else {
            showFailure("Choose a Surls site first.")
            return
        }
        let site = sites[selectedIndex]
        guard let token = try? SiteTokenKeychain.load(for: site.id), !token.isEmpty else {
            showFailure("The API token for \(site.name) is missing. Open Surls Share to add it again.")
            return
        }
        guard let provider = firstFileProvider() else {
            showFailure("No file was included in this share.")
            return
        }

        statusLabel.stringValue = "Checking upload limit…"
        detailLabel.stringValue = provider.suggestedName ?? "Shared file"
        checkUploadLimit(for: site, token: token) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let limit):
                self.loadSharedFile(from: provider, site: site, token: token, code: requestedCode, limit: limit)
            case .failure(let error):
                self.showFailure(error.localizedDescription)
            }
        }
    }

    private func checkUploadLimit(
        for site: SiteProfile,
        token: String,
        completion: @escaping (Result<UploadLimit, Error>) -> Void
    ) {
        guard let url = site.uploadURL else {
            completion(.failure(ShareError("The saved URL for \(site.name) is invalid.")))
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 10
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let attempt = UUID()
        uploadLimitAttempt = attempt
        uploadLimitTask = URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
            DispatchQueue.main.async {
                guard let self, self.uploadLimitAttempt == attempt else { return }
                self.uploadLimitAttempt = nil
                self.uploadLimitTask = nil
                if let error {
                    completion(.failure(error))
                    return
                }
                let httpResponse = response as? HTTPURLResponse
                switch httpResponse?.statusCode ?? 0 {
                case 204:
                    completion(.success(UploadLimit(response: httpResponse)))
                case 401:
                    completion(.failure(ShareError("The API token is invalid or missing uploads:create permission.")))
                case 404, 405:
                    completion(.success(.unknown))
                case let status:
                    completion(.failure(ShareError("Surls returned HTTP \(status) while checking the upload limit.")))
                }
            }
        }
        uploadLimitTask?.resume()
    }

    private func loadSharedFile(
        from provider: NSItemProvider,
        site: SiteProfile,
        token: String,
        code: String,
        limit: UploadLimit
    ) {
        statusLabel.stringValue = "Preparing upload to \(site.name)…"
        let attempt = UUID()
        fileLoadAttempt = attempt
        let timeout = DispatchWorkItem { [weak self] in
            guard let self, self.fileLoadAttempt == attempt else { return }
            self.fileLoadAttempt = nil
            self.fileLoadProgress?.cancel()
            self.fileLoadProgress = nil
            self.fileLoadTimeout = nil
            self.showFailure("The shared file did not become available within 15 seconds. If it is in iCloud or OneDrive, download it first and try again.")
        }
        fileLoadTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: timeout)
        fileLoadProgress = loadFile(from: provider, maximumBytes: limit.maximumReadableBytes) { [weak self] result in
            guard let self, self.fileLoadAttempt == attempt else { return }
            self.fileLoadAttempt = nil
            self.fileLoadTimeout?.cancel()
            self.fileLoadTimeout = nil
            self.fileLoadProgress = nil
            switch result {
            case .success(let file):
                if let message = limit.rejectionMessage(fileBytes: file.data.count) {
                    self.showFailure(message)
                } else {
                    self.upload(file, to: site, token: token, code: code)
                }
            case .failure(let error): self.showFailure(error.localizedDescription)
            }
        }
    }

    private func firstFileProvider() -> NSItemProvider? {
        (extensionContext?.inputItems as? [NSExtensionItem])?
            .flatMap { $0.attachments ?? [] }
            .first
    }

    private func loadFile(
        from provider: NSItemProvider,
        maximumBytes: Int64,
        completion: @escaping (Result<SharedFile, Error>) -> Void
    ) -> Progress? {
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            let progress = Progress(totalUnitCount: maximumBytes)
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, error in
                if let error { return DispatchQueue.main.async { completion(.failure(error)) } }
                guard let url = Self.fileURL(from: item) else {
                    return DispatchQueue.main.async { completion(.failure(ShareError("Couldn’t read the shared file."))) }
                }
                DispatchQueue.global(qos: .userInitiated).async {
                    let result = Result { try SharedFile(url: url, maximumBytes: maximumBytes, progress: progress) }
                    DispatchQueue.main.async { completion(result) }
                }
            }
            return progress
        }

        guard let typeIdentifier = provider.registeredTypeIdentifiers.first(where: {
            UTType($0)?.conforms(to: .data) == true
        }) else {
            completion(.failure(ShareError("This shared item isn’t a file.")))
            return nil
        }
        return provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { url, error in
            if let error { return DispatchQueue.main.async { completion(.failure(error)) } }
            guard let url else {
                return DispatchQueue.main.async { completion(.failure(ShareError("Couldn’t load the shared file."))) }
            }
            let result = Result {
                try SharedFile(
                    url: url,
                    suggestedName: provider.suggestedName,
                    typeIdentifier: typeIdentifier,
                    maximumBytes: maximumBytes
                )
            }
            DispatchQueue.main.async { completion(result) }
        }
    }

    private static func fileURL(from item: Any?) -> URL? {
        let url: URL?
        switch item {
        case let value as URL:
            url = value
        case let value as NSURL:
            url = value as URL
        case let value as Data:
            url = URL(dataRepresentation: value, relativeTo: nil, isAbsolute: true)
        case let value as String:
            url = URL(string: value)
        default:
            url = nil
        }
        return url?.isFileURL == true ? url : nil
    }

    func controlTextDidChange(_ notification: Notification) {
        guard notification.object as? NSTextField === keywordField else { return }
        scheduleKeywordCheck()
    }

    @objc private func siteSelectionChanged() {
        scheduleKeywordCheck()
    }

    private func scheduleKeywordCheck() {
        cancelKeywordCheck()
        let code = keywordField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else {
            keywordIsValid = true
            keywordStatusLabel.isHidden = true
            uploadButton.isEnabled = true
            return
        }
        if let validationError = Self.keywordValidationError(code) {
            updateKeywordStatus(validationError, valid: false)
            return
        }

        keywordIsValid = false
        uploadButton.isEnabled = false
        keywordStatusLabel.stringValue = "Checking availability…"
        keywordStatusLabel.textColor = .secondaryLabelColor
        keywordStatusLabel.isHidden = false
        let attempt = UUID()
        keywordCheckAttempt = attempt
        let workItem = DispatchWorkItem { [weak self] in
            self?.checkKeyword(code, attempt: attempt)
        }
        keywordCheckWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: workItem)
    }

    private func checkKeyword(_ code: String, attempt: UUID) {
        let selectedIndex = sitePicker.indexOfSelectedItem
        guard sites.indices.contains(selectedIndex),
              let token = try? SiteTokenKeychain.load(for: sites[selectedIndex].id),
              !token.isEmpty,
              let uploadURL = sites[selectedIndex].uploadURL,
              var components = URLComponents(url: uploadURL, resolvingAgainstBaseURL: false) else {
            updateKeywordStatus("Couldn’t check this keyword with the selected site.", valid: false)
            return
        }
        components.queryItems = (components.queryItems ?? []) + [URLQueryItem(name: "code", value: code)]
        guard let url = components.url else {
            updateKeywordStatus("Couldn’t check this keyword with the selected site.", valid: false)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 8
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        keywordCheckTask = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self, self.keywordCheckAttempt == attempt else { return }
                self.keywordCheckAttempt = nil
                self.keywordCheckTask = nil
                if let error {
                    self.updateKeywordStatus(error.localizedDescription, valid: false)
                    return
                }
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                let payload = data.flatMap { try? JSONDecoder().decode(CodeAvailabilityResponse.self, from: $0) }
                guard status == 200, payload?.available == true else {
                    let message = payload?.error
                        ?? (status == 404 || status == 405
                            ? "Update this Surls site to enable keyword checks."
                            : "Couldn’t check this keyword (HTTP \(status)).")
                    self.updateKeywordStatus(message, valid: false)
                    return
                }
                self.updateKeywordStatus("Available", valid: true)
            }
        }
        keywordCheckTask?.resume()
    }

    private func updateKeywordStatus(_ message: String, valid: Bool) {
        keywordIsValid = valid
        keywordStatusLabel.stringValue = message
        keywordStatusLabel.textColor = valid ? .systemGreen : .systemRed
        keywordStatusLabel.isHidden = false
        uploadButton.isEnabled = valid
    }

    private func cancelKeywordCheck() {
        keywordCheckWorkItem?.cancel()
        keywordCheckWorkItem = nil
        keywordCheckTask?.cancel()
        keywordCheckTask = nil
        keywordCheckAttempt = nil
    }

    private func upload(_ file: SharedFile, to site: SiteProfile, token: String, code: String) {
        guard let url = site.uploadURL else {
            showFailure("The saved URL for \(site.name) is invalid.")
            return
        }
        let boundary = "SurlsBoundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        let bodyURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("surls-share-\(UUID().uuidString).multipart")
        let bodyLength: Int64
        do {
            bodyLength = try MultipartBody.write(
                boundary: boundary,
                fields: [("filenameMode", "safe"), ("title", file.name), ("code", code)],
                file: file,
                to: bodyURL
            )
        } catch {
            try? FileManager.default.removeItem(at: bodyURL)
            showFailure(error.localizedDescription)
            return
        }
        uploadBodyURL = bodyURL
        request.setValue(String(bodyLength), forHTTPHeaderField: "Content-Length")

        progress.stopAnimation(nil)
        progress.isHidden = true
        uploadProgress.doubleValue = 0
        uploadPercentLabel.stringValue = "0%"
        uploadProgressContainer.isHidden = false

        let attempt = UUID()
        uploadAttempt = attempt
        let session = URLSession(configuration: .ephemeral, delegate: self, delegateQueue: .main)
        uploadSession = session
        uploadTask = session.uploadTask(with: request, fromFile: bodyURL) { [weak self] data, response, error in
            try? FileManager.default.removeItem(at: bodyURL)
            DispatchQueue.main.async {
                guard let self, self.uploadAttempt == attempt else { return }
                if self.uploadBodyURL == bodyURL { self.uploadBodyURL = nil }
                self.uploadAttempt = nil
                self.uploadTask = nil
                self.uploadSession?.finishTasksAndInvalidate()
                self.uploadSession = nil
                if let error {
                    self.showFailure(error.localizedDescription)
                    return
                }
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                let payload = data.flatMap { try? JSONDecoder().decode(UploadResponse.self, from: $0) }
                guard status == 201, let shortURL = payload?.shortUrl else {
                    let message = payload?.error ?? "Surls returned HTTP \(status)."
                    if !code.isEmpty && Self.isKeywordError(message) {
                        self.keywordIsValid = false
                        self.keywordStatusLabel.stringValue = message
                        self.keywordStatusLabel.textColor = .systemRed
                        self.keywordStatusLabel.isHidden = false
                    }
                    self.showFailure(message)
                    return
                }
                self.copyAndFinish(shortURL, siteName: site.name)
            }
        }
        uploadTask?.resume()
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        guard task === uploadTask, totalBytesExpectedToSend > 0 else { return }
        let fraction = min(1, max(0, Double(totalBytesSent) / Double(totalBytesExpectedToSend)))
        let percent = Int((fraction * 100).rounded())
        uploadProgress.doubleValue = Double(percent)
        uploadPercentLabel.stringValue = "\(percent)%"
    }

    private func copyAndFinish(_ shortURL: String, siteName: String) {
        generatedShortURL = shortURL
        copyToPasteboard(shortURL)
        progress.stopAnimation(nil)
        progress.isHidden = true
        uploadProgressContainer.isHidden = true
        sitePicker.isHidden = true
        keywordContainer.isHidden = true
        uploadButton.isHidden = true
        retryButton.isHidden = true
        copyButton.isHidden = false
        closeButton.title = "Done"
        closeButton.keyEquivalent = "\r"
        closeButton.isHidden = false
        statusLabel.stringValue = "Upload complete"
        detailLabel.stringValue = "\(shortURL)\nCopied to the clipboard. Uploaded with \(siteName)."
    }

    private func showFailure(_ message: String) {
        hasFailed = true
        progress.stopAnimation(nil)
        progress.isHidden = true
        uploadProgressContainer.isHidden = true
        sitePicker.isHidden = true
        keywordContainer.isHidden = true
        uploadButton.isHidden = true
        copyButton.isHidden = true
        closeButton.title = "Close"
        closeButton.keyEquivalent = ""
        statusLabel.stringValue = "Upload failed"
        detailLabel.stringValue = message
        closeButton.isHidden = false
        let editKeyword = !keywordField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !keywordIsValid
        retryButton.title = editKeyword ? "Edit Keyword" : "Try Again"
        retryButton.isHidden = false
        presentFailureAlert(message, editKeyword: editKeyword)
    }

    private func presentFailureAlert(_ message: String, editKeyword: Bool) {
        guard !showingFailureAlert else { return }
        guard let window = view.window else {
            DispatchQueue.main.async { [weak self] in self?.presentFailureAlert(message, editKeyword: editKeyword) }
            return
        }
        showingFailureAlert = true
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Surls Share couldn’t upload the file"
        alert.informativeText = message
        alert.addButton(withTitle: "Close")
        alert.addButton(withTitle: editKeyword ? "Edit Keyword" : "Try Again")
        alert.beginSheetModal(for: window) { [weak self] response in
            guard let self else { return }
            self.showingFailureAlert = false
            if response == .alertSecondButtonReturn {
                if editKeyword {
                    self.showSiteChooser()
                } else {
                    self.beginUpload()
                }
            } else {
                self.closeExtension()
            }
        }
    }

    @objc private func closeExtension() {
        uploadAttempt = nil
        uploadTask?.cancel()
        uploadSession?.invalidateAndCancel()
        uploadTask = nil
        uploadSession = nil
        removeUploadBody()
        cancelKeywordCheck()
        cancelFileLoad()
        if hasFailed || generatedShortURL != nil {
            extensionContext?.completeRequest(returningItems: nil)
        } else {
            extensionContext?.cancelRequest(withError: ShareError("Upload cancelled."))
        }
    }

    @objc private func retry() {
        if sites.isEmpty || (!keywordField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !keywordIsValid) {
            showSiteChooser()
        } else {
            beginUpload()
        }
    }

    @objc private func beginSelectedUpload() {
        beginUpload()
    }

    @objc private func copyGeneratedURL() {
        guard let generatedShortURL else { return }
        copyToPasteboard(generatedShortURL)
        statusLabel.stringValue = "Short URL copied"
    }

    private func copyToPasteboard(_ value: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }

    private func cancelFileLoad() {
        uploadLimitTask?.cancel()
        uploadLimitTask = nil
        uploadLimitAttempt = nil
        fileLoadTimeout?.cancel()
        fileLoadTimeout = nil
        fileLoadProgress?.cancel()
        fileLoadProgress = nil
        fileLoadAttempt = nil
    }

    private func removeUploadBody() {
        guard let uploadBodyURL else { return }
        try? FileManager.default.removeItem(at: uploadBodyURL)
        self.uploadBodyURL = nil
    }

    private static func isKeywordError(_ message: String) -> Bool {
        let lowercased = message.lowercased()
        return lowercased.contains("alias")
            || lowercased.contains("keyword")
            || lowercased.contains("reserved")
            || lowercased.contains("3-64")
            || lowercased.contains("visually confusing")
    }

    private static func keywordValidationError(_ value: String) -> String? {
        guard value.count >= 3, value.count <= 64,
              value.range(of: #"^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$"#, options: .regularExpression) != nil else {
            return "Use 3–64 letters, numbers, underscores, or hyphens."
        }
        let reserved = Set([
            "admin", "api", "assets", "uploads", "health", "login", "logout", "s", "static", "_next",
            "apple-touch-icon.png", "favicon.ico", "favicon.svg", "icon-192.png", "icon-512.png", "robots.txt", "site.webmanifest"
        ])
        if reserved.contains(value.lowercased()) {
            return "This keyword is reserved for Surls system routes."
        }
        if value.range(of: "[IO0]", options: .regularExpression) != nil {
            return "Avoid visually confusing characters like I, O, or 0."
        }
        return nil
    }
}

private struct SharedFile {
    let data: Data
    let name: String
    let mimeType: String

    init(
        url: URL,
        suggestedName: String? = nil,
        typeIdentifier: String? = nil,
        maximumBytes: Int64,
        progress: Progress? = nil
    ) throws {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        let reportedSize = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize
        if let reportedSize, Int64(reportedSize) > maximumBytes {
            throw ShareError("The selected file is larger than the allowed upload limit.")
        }

        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var boundedData = Data()
        let chunkSize = 1024 * 1024
        while true {
            if progress?.isCancelled == true { throw CancellationError() }
            let remaining = maximumBytes - Int64(boundedData.count)
            if remaining < 0 { throw ShareError("The selected file is larger than the allowed upload limit.") }
            let readSize = Int(min(Int64(chunkSize), remaining + 1))
            guard readSize > 0, let chunk = try handle.read(upToCount: readSize), !chunk.isEmpty else { break }
            boundedData.append(chunk)
            if Int64(boundedData.count) > maximumBytes {
                throw ShareError("The selected file is larger than the allowed upload limit.")
            }
            progress?.completedUnitCount = Int64(boundedData.count)
        }
        data = boundedData
        name = suggestedName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? url.lastPathComponent
        let type = typeIdentifier.flatMap(UTType.init) ?? UTType(filenameExtension: url.pathExtension)
        mimeType = type?.preferredMIMEType ?? "application/octet-stream"
    }
}

private struct UploadResponse: Decodable {
    let shortUrl: String?
    let error: String?
}

private struct CodeAvailabilityResponse: Decodable {
    let available: Bool?
    let error: String?
}

private struct ShareError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

private enum MultipartBody {
    static func write(
        boundary: String,
        fields: [(String, String)],
        file: SharedFile,
        to url: URL
    ) throws -> Int64 {
        FileManager.default.createFile(atPath: url.path, contents: nil)
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }

        func write(_ value: String) throws {
            try handle.write(contentsOf: Data(value.utf8))
        }
        for (name, value) in fields {
            try write("--\(boundary)\r\n")
            try write("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
            try write("\(value)\r\n")
        }
        let unsafeCharacters = CharacterSet.controlCharacters.union(CharacterSet(charactersIn: "\\\""))
        let safeFilename = file.name.unicodeScalars
            .map { unsafeCharacters.contains($0) ? "_" : String($0) }
            .joined()
        try write("--\(boundary)\r\n")
        try write("Content-Disposition: form-data; name=\"file\"; filename=\"\(safeFilename)\"\r\n")
        try write("Content-Type: \(file.mimeType)\r\n\r\n")
        try handle.write(contentsOf: file.data)
        try write("\r\n--\(boundary)--\r\n")
        return Int64(try handle.offset())
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
