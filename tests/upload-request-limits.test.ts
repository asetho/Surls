import { describe, expect, it, vi } from "vitest";

describe("upload request admission", () => {
  it("shares per-user and process caps across separately loaded server bundles", async () => {
    const first = await import("@/lib/upload-request-limits");
    const releases: Array<() => void> = [];
    try {
      const firstRelease = first.acquireUploadRequest("user-a");
      expect(firstRelease).not.toBeNull();
      releases.push(firstRelease!);

      vi.resetModules();
      const second = await import("@/lib/upload-request-limits");
      const secondForA = second.acquireUploadRequest("user-a");
      expect(secondForA).not.toBeNull();
      releases.push(secondForA!);
      expect(first.acquireUploadRequest("user-a")).toBeNull();

      for (let index = 0; index < first.UPLOAD_MAX_CONCURRENT_PER_USER; index += 1) {
        const release = second.acquireUploadRequest("user-b");
        expect(release).not.toBeNull();
        releases.push(release!);
      }
      expect(first.acquireUploadRequest("user-c")).toBeNull();
      expect(second.acquireUploadRequest("user-c")).toBeNull();
    } finally {
      releases.forEach((release) => release());
    }

    const recovered = first.acquireUploadRequest("user-a");
    expect(recovered).toEqual(expect.any(Function));
    recovered?.();
  });
});
