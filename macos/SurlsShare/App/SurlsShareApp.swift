import SwiftUI

@main
struct SurlsShareApp: App {
    @StateObject private var siteStore = SiteStore()

    var body: some Scene {
        WindowGroup {
            ContentView(store: siteStore)
                .frame(minWidth: 620, minHeight: 420)
        }
        .windowResizability(.contentMinSize)
    }
}
