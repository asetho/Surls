"use client";

import { Copy, Download, ExternalLink, QrCode, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  QR_ERROR_CORRECTION_LEVELS,
  QR_FORMATS,
  QR_SIZES,
  qrAssetPath,
  type QrErrorCorrectionLevel,
  type QrFormat,
  type QrSize
} from "@/lib/qr";

const formatLabels: Record<QrFormat, string> = {
  png: "PNG image",
  svg: "SVG image",
  eps: "EPS image"
};

function formatUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function QrCodeModal({ baseUrl, linkId, shortUrl }: { baseUrl: string; linkId: string; shortUrl: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [size, setSize] = useState<QrSize>(300);
  const [level, setLevel] = useState<QrErrorCorrectionLevel>("M");
  const [copied, setCopied] = useState<QrFormat | null>(null);

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function directUrl(format: QrFormat) {
    return formatUrl(baseUrl, qrAssetPath({ linkId, format, size, level }));
  }

  function downloadUrl(format: QrFormat) {
    return formatUrl(baseUrl, qrAssetPath({ linkId, format, size, level, download: true }));
  }

  async function copyLink(format: QrFormat) {
    await navigator.clipboard.writeText(directUrl(format));
    setCopied(format);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <>
      <button type="button" className="button secondary" onClick={openDialog}>
        <QrCode size={16} aria-hidden />
        QR code
      </button>
      <dialog
        className="modal-dialog"
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="modal-panel qr-modal-panel">
          <div className="modal-header">
            <div>
              <h2 id={titleId}>QR code</h2>
              <p className="muted small">QR target: {shortUrl}</p>
            </div>
            <button type="button" className="icon-button secondary" onClick={closeDialog} aria-label="Close QR dialog">
              <X size={16} aria-hidden />
            </button>
          </div>

          <div className="qr-controls">
            <fieldset className="segmented-field">
              <legend>Error correction</legend>
              <div className="segmented-control">
                {QR_ERROR_CORRECTION_LEVELS.map((option) => (
                  <button
                    type="button"
                    aria-pressed={level === option}
                    onClick={() => setLevel(option)}
                    key={option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="segmented-field">
              <legend>Image size</legend>
              <div className="segmented-control">
                {QR_SIZES.map((option) => (
                  <button type="button" aria-pressed={size === option} onClick={() => setSize(option)} key={option}>
                    {option}px
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="qr-output-list">
            {QR_FORMATS.map((format) => (
              <section className="qr-output" key={format}>
                <h3>{formatLabels[format]}</h3>
                <div className="qr-output-grid">
                  {format !== "eps" ? (
                    <div className="qr-box">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={`${format.toUpperCase()} QR code for ${shortUrl}`}
                        src={directUrl(format)}
                        width={Math.min(size, 180)}
                        height={Math.min(size, 180)}
                      />
                    </div>
                  ) : (
                    <div className="qr-file-placeholder">
                      <strong>EPS</strong>
                      <span className="muted small">Vector file</span>
                    </div>
                  )}
                  <div className="qr-link-actions">
                    <div>
                      <span className="muted small">Direct image link</span>
                      <a href={directUrl(format)} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} aria-hidden />
                        {directUrl(format)}
                      </a>
                    </div>
                    <div className="row-actions">
                      <button type="button" className="secondary icon-button" onClick={() => copyLink(format)}>
                        <Copy size={16} aria-hidden />
                        {copied === format ? "Copied" : "Copy link"}
                      </button>
                      <a className="button secondary icon-button" href={downloadUrl(format)}>
                        <Download size={16} aria-hidden />
                        Download QR image file
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
