## Mobile UX Foundations (Pass 1)

- **Breakpoint**: `useIsMobile()` checks `max-width: 767px` (Tailwind `md` breakpoint). Anything under `md` is treated as mobile.

- **AdaptiveDialog**: Renders a shadcn `Dialog` on desktop and a bottom `Sheet` on mobile using the same props (`open`, `onOpenChange`, `title`, optional `description`, `children`, optional `footer`). No API differences—callers just swap imports.

- **MobileActionBar**: Mobile-only sticky footer for primary/secondary actions. It pads for safe areas and ships a `MobileActionBarSpacer` helper—drop the spacer near the bottom of a page when the bar is present so content isn’t hidden behind it.

- **ResponsiveDataList**: Foundation for table → card rendering. Provide `items`, a `renderMobileCard(item)` function, and a `renderDesktop(items)` renderer. On mobile it maps cards; on desktop it defers to the provided table renderer.

- **Navigation on mobile**: The global shell now shows a hamburger in the header under `md` that opens the sidebar inside a `Sheet`. Desktop sidebar remains unchanged.

- **Quick test**: Use browser device emulation (<768px). Confirm the hamburger opens the nav drawer and an `AdaptiveDialog` instance (e.g., any dialog) swaps to a bottom sheet. Check the MobileActionBarSpacer leaves enough breathing room when the bar is visible.
