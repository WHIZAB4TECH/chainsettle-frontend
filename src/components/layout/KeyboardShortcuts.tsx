"use client";

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { useRouter } from "next/navigation";

const shortcuts = [
  { key: "/", description: "Focus shipment search" },
  { key: "n", description: "Create a new shipment" },
  { key: "?", description: "Show keyboard shortcuts" },
];

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHelpOpen(false);
        return;
      }

      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTextField(event.target)
      )
        return;

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen((open) => !open);
      } else if (event.key === "/") {
        event.preventDefault();
        router.push("/dashboard/shipments?focus=search");
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        router.push("/dashboard/shipments/create");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <>
      <span className="no-print sr-only" aria-live="polite">
        Keyboard shortcuts available
      </span>
      {helpOpen && (
        <div className="no-print fixed bottom-5 right-5 z-50 w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Keyboard className="h-4 w-4 text-brand-600" />
              Keyboard shortcuts
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
              aria-label="Close keyboard shortcuts"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="text-gray-500">{shortcut.description}</span>
                <kbd className="min-w-6 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-center font-mono text-gray-700">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-gray-100 pt-3 text-[10px] text-gray-400">
            Shortcuts pause while typing.
          </p>
        </div>
      )}
    </>
  );
}
