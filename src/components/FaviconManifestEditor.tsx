"use client";

import { useId, useState } from "react";
import Image from "next/image";

type FaviconManifestEditorProps = {
  defaultName: string;
  defaultShortName: string;
  formId: string;
  iconSrc?: string;
};

function previewInitial(name: string) {
  return (name.trim()[0] || "S").toUpperCase();
}

function PreviewIcon({ className = "", iconSrc, name }: { className?: string; iconSrc?: string; name: string }) {
  return (
    <div className={`favicon-preview-icon ${className}`.trim()}>
      {iconSrc ? <Image src={iconSrc} alt="" width={64} height={64} unoptimized /> : <span>{previewInitial(name)}</span>}
    </div>
  );
}

export function FaviconManifestEditor({
  defaultName,
  defaultShortName,
  formId,
  iconSrc
}: FaviconManifestEditorProps) {
  const id = useId();
  const [name, setName] = useState(defaultName);
  const [shortName, setShortName] = useState(defaultShortName);
  const previewName = name.trim() || defaultName || "Surls";
  const previewShortName = shortName.trim() || previewName;

  return (
    <div className="favicon-manifest-editor">
      <div className="favicon-manifest-fields">
        <label htmlFor={`${id}-name`}>
          App name
          <input
            form={formId}
            id={`${id}-name`}
            maxLength={64}
            name="manifestName"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <span className="muted small">Used as the full installed app name in the generated web manifest.</span>
        </label>
        <label htmlFor={`${id}-short-name`}>
          Short name
          <input
            form={formId}
            id={`${id}-short-name`}
            maxLength={24}
            name="manifestShortName"
            value={shortName}
            onChange={(event) => setShortName(event.target.value)}
          />
          <span className="muted small">Used below the home-screen icon when space is limited.</span>
        </label>
      </div>

      <div className="favicon-preview-strip" aria-label="Web app install preview">
        <section className="favicon-preview-card favicon-preview-ios-card" aria-label="iOS home screen preview">
          <h4>iOS</h4>
          <div className="favicon-ios-home">
            <div className="favicon-preview-app">
              <span className="favicon-faux-icon favicon-faux-camera" aria-hidden="true" />
              <span>Camera</span>
            </div>
            <div className="favicon-preview-app">
              <span className="favicon-faux-icon favicon-faux-maps" aria-hidden="true" />
              <span>Maps</span>
            </div>
            <div className="favicon-preview-app">
              <span className="favicon-faux-icon favicon-faux-notes" aria-hidden="true" />
              <span>Notes</span>
            </div>
            <div className="favicon-preview-app">
              <PreviewIcon className="favicon-preview-icon-ios" iconSrc={iconSrc} name={previewName} />
              <span>{previewShortName}</span>
            </div>
          </div>
        </section>

        <section className="favicon-preview-card favicon-preview-android-home-card" aria-label="Android home screen preview">
          <h4>Android Home</h4>
          <div className="favicon-android-home">
            <div className="favicon-preview-app">
              <span className="favicon-faux-icon favicon-faux-mail" aria-hidden="true" />
              <span>Mail</span>
            </div>
            <div className="favicon-preview-app">
              <span className="favicon-faux-icon favicon-faux-drive" aria-hidden="true" />
              <span>Drive</span>
            </div>
            <div className="favicon-preview-app">
              <span className="favicon-faux-icon favicon-faux-pin" aria-hidden="true" />
              <span>Maps</span>
            </div>
            <div className="favicon-preview-app">
              <PreviewIcon className="favicon-preview-icon-android" iconSrc={iconSrc} name={previewName} />
              <span>{previewShortName}</span>
            </div>
          </div>
        </section>

        <section className="favicon-preview-card favicon-preview-splash-card" aria-label="Android splash screen preview">
          <h4>Splash</h4>
          <div className="favicon-splash-phone">
            <div className="favicon-splash-status" aria-hidden="true">
              <span>23:16</span>
              <span />
            </div>
            <div className="favicon-splash-content">
              <PreviewIcon className="favicon-preview-icon-splash" iconSrc={iconSrc} name={previewName} />
              <span>{previewShortName}</span>
            </div>
            <span className="favicon-splash-handle" aria-hidden="true" />
          </div>
        </section>

        <section className="favicon-preview-card favicon-preview-switch-card" aria-label="Android app switcher preview">
          <h4>Switch</h4>
          <div className="favicon-switch-preview">
            <div className="favicon-switch-status" aria-hidden="true">
              <span>23:16</span>
              <span />
            </div>
            <PreviewIcon className="favicon-preview-icon-switch" iconSrc={iconSrc} name={previewName} />
            <div className="favicon-switch-phone" aria-hidden="true">
              <div className="favicon-switch-phone-card">
                <span />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
