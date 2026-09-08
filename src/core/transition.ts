export function setupPageTransitions(): void {
  document.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const anchor = (event.target as Element | null)?.closest?.("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;
    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("//") ||
      href.startsWith("#")
    ) {
      return;
    }

    event.preventDefault();
    document.body.classList.add("page-exit");
    window.setTimeout(() => {
      window.location.href = href;
    }, 200);
  });
}
