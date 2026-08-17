import SwiftUI

struct ContentView: View {
    @ObservedObject var store: SiteStore
    @State private var selection: UUID?
    @State private var editingProfile: SiteProfile?
    @State private var showingEditor = false

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
                        .tag(profile.id)
                    }
                    .frame(minHeight: 210)
                }
            }

            HStack {
                Button("Add Site", systemImage: "plus") {
                    editingProfile = nil
                    showingEditor = true
                }
                Button("Edit", systemImage: "pencil") {
                    editingProfile = selectedProfile
                    showingEditor = selectedProfile != nil
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
        }
        .padding(24)
        .sheet(isPresented: $showingEditor) {
            SiteEditor(profile: editingProfile) { profile, token in
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

private struct SiteEditor: View {
    @Environment(\.dismiss) private var dismiss
    let original: SiteProfile?
    let onSave: (SiteProfile, String?) -> Void

    @State private var name: String
    @State private var baseURL: String
    @State private var token = ""
    @State private var validationMessage: String?

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
                TextField("Name", text: $name, prompt: Text("asetho.link"))
                TextField("Base URL", text: $baseURL, prompt: Text("https://asetho.link"))
                    .textContentType(.URL)
                SecureField(original == nil ? "API token" : "New API token (optional)", text: $token)
                    .textContentType(.password)
            }
            if let validationMessage {
                Text(validationMessage).foregroundStyle(.red).font(.caption)
            }
            Text("The token is stored in your Mac keychain and shared only with the Surls extension.")
                .font(.caption)
                .foregroundStyle(.secondary)
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
