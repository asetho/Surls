import Foundation
import SwiftUI

struct ContentView: View {
    @ObservedObject var store: SiteStore
    @State private var selection: UUID?
    @State private var editorPresentation: SiteEditorPresentation?

    private var selectedProfile: SiteProfile? {
        store.profiles.first { $0.id == selection }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Surls Share")
                    .font(.largeTitle.bold())
                Text("Add each Surls site once. “Share with Surls” uploads to the default site and copies the short URL.")
                    .foregroundStyle(.secondary)
            }

            GroupBox("Sites") {
                if store.profiles.isEmpty {
                    ContentUnavailableView(
                        "No Surls Sites",
                        systemImage: "link.badge.plus",
                        description: Text("Add a site and an API token from Admin → Tools.")
                    )
                    .frame(maxWidth: .infinity, minHeight: 210)
                } else {
                    List(store.profiles, selection: $selection) { profile in
                        HStack(spacing: 12) {
                            Image(systemName: profile.isDefault ? "star.fill" : "globe")
                                .foregroundStyle(profile.isDefault ? .yellow : .secondary)
                                .frame(width: 18)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(profile.name).fontWeight(.medium)
                                Text(profile.baseURL).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if profile.isDefault {
                                Text("Default").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture(count: 2) {
                            selection = profile.id
                            editorPresentation = SiteEditorPresentation(profile: profile)
                        }
                        .tag(profile.id)
                    }
                    .frame(minHeight: 210)
                }
            }

            HStack {
                Button("Add Site", systemImage: "plus") {
                    editorPresentation = SiteEditorPresentation(profile: nil)
                }
                Button("Edit", systemImage: "pencil") {
                    if let selectedProfile {
                        editorPresentation = SiteEditorPresentation(profile: selectedProfile)
                    }
                }
                .disabled(selectedProfile == nil)
                Button("Remove", systemImage: "trash", role: .destructive) {
                    if let selection { store.delete(selection); self.selection = nil }
                }
                .disabled(selectedProfile == nil)
                Spacer()
                Button("Make Default", systemImage: "star") {
                    if let selection { store.makeDefault(selection) }
                }
                .disabled(selectedProfile == nil || selectedProfile?.isDefault == true)
            }

            Text("After installing, enable Share with Surls in System Settings → General → Login Items & Extensions → Sharing.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Text("© 2026 asetho™")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(24)
        .sheet(item: $editorPresentation) { presentation in
            SiteEditor(profile: presentation.profile) { profile, token in
                store.save(profile: profile, token: token)
                selection = profile.id
            }
        }
        .alert("Couldn’t Save Site", isPresented: Binding(
            get: { store.errorMessage != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("OK") { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "Unknown error")
        }
    }
}

private struct SiteEditorPresentation: Identifiable {
    let id = UUID()
    let profile: SiteProfile?
}

private struct SiteEditor: View {
    @Environment(\.dismiss) private var dismiss
    let original: SiteProfile?
    let onSave: (SiteProfile, String?) -> Void

    @State private var name: String
    @State private var baseURL: String
    @State private var token = ""
    @State private var validationMessage: String?
    @State private var isTesting = false
    @State private var testMessage: String?
    @State private var testSucceeded = false
    @State private var testTask: Task<Void, Never>?

    init(profile: SiteProfile?, onSave: @escaping (SiteProfile, String?) -> Void) {
        original = profile
        self.onSave = onSave
        _name = State(initialValue: profile?.name ?? "")
        _baseURL = State(initialValue: profile?.baseURL ?? "")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(original == nil ? "Add Surls Site" : "Edit Surls Site")
                .font(.title2.bold())
            Form {
                TextField("Name", text: $name, prompt: Text("example.com"))
                    .onChange(of: name) { _, _ in clearFeedback() }
                TextField("Base URL", text: $baseURL, prompt: Text("https://example.com"))
                    .textContentType(.URL)
                    .onChange(of: baseURL) { _, _ in clearFeedback() }
                SecureField(original == nil ? "API token" : "New API token (optional)", text: $token)
                    .textContentType(.password)
                    .onChange(of: token) { _, _ in clearFeedback() }
            }
            if let validationMessage {
                Text(validationMessage).foregroundStyle(.red).font(.caption)
            }
            Text("The token is stored in your Mac keychain and shared only with the Surls extension.")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(spacing: 10) {
                Button {
                    testConnection()
                } label: {
                    HStack(spacing: 6) {
                        if isTesting {
                            ProgressView().controlSize(.small)
                        }
                        Text(isTesting ? "Testing…" : "Test Connection")
                    }
                }
                .disabled(isTesting)
                if let testMessage {
                    Label(
                        testMessage,
                        systemImage: testSucceeded ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
                    )
                    .font(.caption)
                    .foregroundStyle(testSucceeded ? .green : .red)
                }
            }
            HStack {
                Spacer()
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Save") { save() }
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(24)
        .frame(width: 480)
        .onDisappear { testTask?.cancel() }
    }

    private func testConnection() {
        testTask?.cancel()
        testMessage = nil
        let enteredToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        let testToken: String
        do {
            if !enteredToken.isEmpty {
                testToken = enteredToken
            } else if let original,
                      let savedToken = try SiteTokenKeychain.load(for: original.id),
                      !savedToken.isEmpty {
                testToken = savedToken
            } else {
                showTestFailure("Enter an API token first.")
                return
            }
        } catch {
            showTestFailure(error.localizedDescription)
            return
        }

        guard let cleanURL = SiteProfile.normalizedBaseURL(baseURL),
              let uploadURL = URL(string: cleanURL)?.appending(path: "api/uploads") else {
            showTestFailure("Enter a valid Surls base URL first.")
            return
        }

        var request = URLRequest(url: uploadURL)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 10
        request.setValue("Bearer \(testToken)", forHTTPHeaderField: "Authorization")
        isTesting = true
        testTask = Task {
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                guard !Task.isCancelled else { return }
                var status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if status == 404 || status == 405 {
                    var compatibilityRequest = URLRequest(url: uploadURL)
                    let boundary = "SurlsConnectionTest-\(UUID().uuidString)"
                    compatibilityRequest.httpMethod = "POST"
                    compatibilityRequest.timeoutInterval = 10
                    compatibilityRequest.setValue("Bearer \(testToken)", forHTTPHeaderField: "Authorization")
                    compatibilityRequest.setValue(
                        "multipart/form-data; boundary=\(boundary)",
                        forHTTPHeaderField: "Content-Type"
                    )
                    compatibilityRequest.httpBody = Data("--\(boundary)--\r\n".utf8)
                    let (_, compatibilityResponse) = try await URLSession.shared.data(for: compatibilityRequest)
                    guard !Task.isCancelled else { return }
                    let compatibilityStatus = (compatibilityResponse as? HTTPURLResponse)?.statusCode ?? 0
                    if compatibilityStatus == 400 {
                        status = 204
                    } else {
                        status = compatibilityStatus
                    }
                }
                isTesting = false
                testSucceeded = status == 204
                switch status {
                case 204:
                    testMessage = "Connection successful"
                case 401:
                    testMessage = "Token is invalid or missing uploads:create permission."
                case 404, 405:
                    testMessage = "This Surls site needs the latest server update."
                default:
                    testMessage = "Surls returned HTTP \(status)."
                }
            } catch {
                guard !Task.isCancelled else { return }
                isTesting = false
                testSucceeded = false
                testMessage = error.localizedDescription
            }
        }
    }

    private func showTestFailure(_ message: String) {
        isTesting = false
        testSucceeded = false
        testMessage = message
    }

    private func clearFeedback() {
        testTask?.cancel()
        isTesting = false
        validationMessage = nil
        testMessage = nil
        testSucceeded = false
    }

    private func save() {
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty else {
            validationMessage = "Enter a site name."
            return
        }
        guard let cleanURL = SiteProfile.normalizedBaseURL(baseURL) else {
            validationMessage = "Enter an HTTPS Surls base URL. HTTP is allowed only for localhost."
            return
        }
        if original == nil && token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            validationMessage = "Enter an API token."
            return
        }
        let profile = SiteProfile(
            id: original?.id ?? UUID(),
            name: cleanName,
            baseURL: cleanURL,
            isDefault: original?.isDefault ?? false
        )
        onSave(profile, token.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty)
        dismiss()
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
