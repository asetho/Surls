import AppKit
import SwiftUI

@main
struct SurlsShareApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var siteStore = SiteStore()

    var body: some Scene {
        WindowGroup {
            ContentView(store: siteStore)
                .frame(minWidth: 620, minHeight: 420)
        }
        .windowResizability(.contentMinSize)
    }
}

private final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowWillClose),
            name: NSWindow.willCloseNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowDidBecomeKey),
            name: NSWindow.didBecomeKeyNotification,
            object: nil
        )
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationShouldHandleReopen(
        _ sender: NSApplication,
        hasVisibleWindows flag: Bool
    ) -> Bool {
        sender.setActivationPolicy(.regular)
        sender.activate(ignoringOtherApps: true)
        return true
    }

    @objc private func windowWillClose() {
        DispatchQueue.main.async {
            guard !NSApp.windows.contains(where: \.isVisible) else { return }
            NSApp.setActivationPolicy(.accessory)
        }
    }

    @objc private func windowDidBecomeKey() {
        NSApp.setActivationPolicy(.regular)
    }
}
