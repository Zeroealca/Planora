import { useEffect, useRef, type RefObject } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

let scrollLockCount = 0;
let previousBodyOverflow = "";
const activeDialogs: HTMLElement[] = [];

function focusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((element) => element.getClientRects().length > 0);
}

/**
 * Applies the shared keyboard and focus behavior expected from a modal dialog.
 * It deliberately keeps the visual layout in each feature while sharing the
 * behavior across forms that are already modal dialogs.
 */
export function useModalAccessibility(
  active: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  options: { dismissible?: boolean } = {},
): void {
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(options.dismissible ?? true);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    dismissibleRef.current = options.dismissible ?? true;
  }, [options.dismissible]);

  useEffect(() => {
    if (!active) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    activeDialogs.push(dialog);
    if (scrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    scrollLockCount += 1;

    const focusInitialControl = () => {
      const preferred = dialog.querySelector<HTMLElement>("[autofocus]");
      const target = preferred ?? focusableElements(dialog)[0] ?? dialog;
      target.focus();
    };
    const animationFrame = window.requestAnimationFrame(focusInitialControl);

    function handleKeyDown(event: KeyboardEvent) {
      if (activeDialogs.at(-1) !== dialog) return;

      if (event.key === "Escape" && dismissibleRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = focusableElements(dialog);
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = elements[0]!;
      const last = elements.at(-1)!;
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handleKeyDown);
      const dialogIndex = activeDialogs.lastIndexOf(dialog);
      if (dialogIndex >= 0) activeDialogs.splice(dialogIndex, 1);
      scrollLockCount -= 1;
      if (scrollLockCount === 0)
        document.body.style.overflow = previousBodyOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [active, dialogRef]);
}
