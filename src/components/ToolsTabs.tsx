"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

export type ToolsTab = {
  id: string;
  label: string;
  children: ReactNode;
};

export function ToolsTabs({ tabs }: { tabs: ToolsTab[] }) {
  const id = useId();
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function activateTab(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    setActiveTab(tab.id);
    tabRefs.current[index]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      activateTab((index + 1) % tabs.length);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      activateTab((index - 1 + tabs.length) % tabs.length);
    }
    if (event.key === "Home") {
      event.preventDefault();
      activateTab(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      activateTab(tabs.length - 1);
    }
  }

  return (
    <section className="tools-tabs">
      <div className="tab-list" role="tablist" aria-label="Tools">
        {tabs.map((tab, index) => {
          const selected = tab.id === activeTab;
          return (
            <button
              type="button"
              className="tab-button"
              id={`${id}-${tab.id}-tab`}
              aria-controls={`${id}-${tab.id}-panel`}
              aria-selected={selected}
              role="tab"
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              onClick={() => setActiveTab(tab.id)}
              key={tab.id}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          className="tools-tab-panel"
          id={`${id}-${tab.id}-panel`}
          aria-labelledby={`${id}-${tab.id}-tab`}
          hidden={tab.id !== activeTab}
          role="tabpanel"
          tabIndex={0}
          key={tab.id}
        >
          {tab.children}
        </div>
      ))}
    </section>
  );
}
