"use client";

import { FormEvent, useState } from "react";
import type { RecentClicksView } from "@/lib/recent-clicks-view";
import { MAX_RECENT_CLICK_PAGE_SIZE } from "@/lib/recent-clicks-constants";

type RecentClicksPanelProps = {
  initialData: RecentClicksView;
  linkId: string;
};

function isRecentClicksView(payload: unknown): payload is RecentClicksView {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "pagination" in payload &&
      "rows" in payload &&
      "summary" in payload
  );
}

function ipLookupHref(ipAddressLabel: string) {
  if (ipAddressLabel === "Unknown") return null;
  return `https://ip-lookup.net/?ip=${encodeURIComponent(ipAddressLabel)}`;
}

function IpAddressValue({ ipAddressLabel }: { ipAddressLabel: string }) {
  const lookupHref = ipLookupHref(ipAddressLabel);
  if (!lookupHref) return ipAddressLabel;

  return (
    <a
      className="ip-lookup-link"
      href={lookupHref}
      target="_blank"
      rel="noreferrer"
      aria-label={`Look up IP address ${ipAddressLabel}`}
    >
      {ipAddressLabel}
    </a>
  );
}

function referrerHref(referrerLabel: string) {
  const value = referrerLabel.trim();
  if (!value || ["direct", "[direct]", "(direct)"].includes(value.toLowerCase())) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function ReferrerValue({ referrerLabel }: { referrerLabel: string }) {
  const lookupHref = referrerHref(referrerLabel);
  if (!lookupHref) return <>[{referrerLabel}]</>;

  return (
    <a
      className="referrer-link"
      href={lookupHref}
      target="_blank"
      rel="noreferrer"
      title={referrerLabel}
    >
      [{referrerLabel}]
    </a>
  );
}

export function RecentClicksPanel({ initialData, linkId }: RecentClicksPanelProps) {
  const [data, setData] = useState(initialData);
  const [pageSizeInput, setPageSizeInput] = useState(String(initialData.pagination.pageSize));
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadPage = async (page: number, pageSize = Number.parseInt(pageSizeInput, 10)) => {
    const nextPageSize = Number.isFinite(pageSize) ? pageSize : data.pagination.pageSize;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(nextPageSize)
    });
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch(`/api/links/${linkId}/recent-clicks?${params}`, {
        cache: "no-store",
        headers: { accept: "application/json" }
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecentClicksView(payload)) {
        const errorMessage =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Recent clicks could not be loaded.";
        setError(errorMessage);
        return;
      }
      setData(payload);
      setPageSizeInput(String(payload.pagination.pageSize));
    } finally {
      setIsLoading(false);
    }
  };

  const applyPageSize = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadPage(1);
  };

  return (
    <section className="surface surface-panel" id="recent-clicks" aria-busy={isLoading}>
      <div className="content-header recent-clicks-header">
        <div>
          <h2>Recent clicks</h2>
          <p className="muted small">
            Showing {data.summary.start}-{data.summary.end} of {data.summary.total} clicks.
          </p>
        </div>
        <form className="row-actions recent-clicks-form" onSubmit={applyPageSize}>
          <label>
            Rows
            <input
              name="clickPageSize"
              type="number"
              min="1"
              max={MAX_RECENT_CLICK_PAGE_SIZE}
              value={pageSizeInput}
              onChange={(event) => setPageSizeInput(event.target.value)}
            />
          </label>
          <button className="secondary" type="submit" disabled={isLoading}>
            Apply
          </button>
        </form>
      </div>
      {error ? (
        <div className="alert" role="alert">
          {error}
        </div>
      ) : null}
      <div className="table-wrap">
        <table className="data-table data-table-dense data-table-clicks responsive-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Country</th>
              <th>IP Address</th>
              <th>User Agent [Referrer]</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length ? (
              data.rows.map((click) => (
                <tr key={click.id}>
                  <td className="data-table-time" data-label="Timestamp">
                    <span className="timestamp" title={`Database ID: ${click.id}`}>
                      {click.occurredAtLabel}
                    </span>
                  </td>
                  <td data-label="Country">{click.countryLabel}</td>
                  <td className="ip-cell" data-label="IP Address">
                    <IpAddressValue ipAddressLabel={click.ipAddressLabel} />
                  </td>
                  <td className="user-agent-cell" data-label="User Agent [Referrer]">
                    <span>{click.userAgentLabel}</span>
                    <span className="muted small">
                      <ReferrerValue referrerLabel={click.referrerLabel} />
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>No clicks recorded for this link.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data.pagination.pageCount > 1 ? (
        <nav className="pagination" aria-label="Recent clicks pagination">
          <button
            className="secondary"
            type="button"
            disabled={isLoading || data.pagination.page <= 1}
            onClick={() => {
              void loadPage(data.pagination.page - 1, data.pagination.pageSize);
            }}
          >
            Previous
          </button>
          <span className="muted small">
            Page {data.pagination.page} of {data.pagination.pageCount}
          </span>
          <button
            className="secondary"
            type="button"
            disabled={isLoading || data.pagination.page >= data.pagination.pageCount}
            onClick={() => {
              void loadPage(data.pagination.page + 1, data.pagination.pageSize);
            }}
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
}
