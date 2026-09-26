import { describe, expect, it, vi } from "vitest";

describe("upload request admission", () => {
  it("shares the process cap across separately loaded server bundles", async () => {
    const first = await import("@/lib/upload-request-limits");
    const releases: Array<() => void> = [];
    try {
      const firstRelease = first.acquireUploadRequest();
      expect(firstRelease).not.toBeNull();
      releases.push(firstRelease!);

      vi.resetModules();
      const second = await import("@/lib/upload-request-limits");
      for (let index = 1; index < first.UPLOAD_MAX_CONCURRENT_REQUESTS; index += 1) {
        const release = second.acquireUploadRequest();
        expect(release).not.toBeNull();
        releases.push(release!);
      }
      expect(first.acquireUploadRequest()).toBeNull();
      expect(second.acquireUploadRequest()).toBeNull();
    } finally {
      releases.forEach((release) => release());
    }

    const recovered = first.acquireUploadRequest();
    expect(recovered).toEqual(expect.any(Function));
    recovered?.();
  });
});
