# Packet 1B — responsive shell correction

User reported desktop overflow, a non-collapsible coworker sidebar, and poor icons.

The application now occupies the dynamic viewport with no document scrolling. Removed room and sidebar minimum heights; room, history, and log own their overflow. The bottom status bar stays within the room. Coworker panel can be hidden, expands the room on desktop, defaults closed below 1000px, and opens as an overlay on narrow screens. Selecting a colleague opens it. Navigation uses consistent 24-unit outline icons. Coworker actions stay visible above 600px viewport height; shorter windows scroll the dialogue body.

Verified 1440x900, 1366x768, 1280x720, 1024x600, 768x1024, 390x844, and 667x375 in the served browser for warm, cool, and editorial treatments. Assertions cover no document overflow, visible bottom bar and terminal bounds, collapse/reopen, and opening Projects. Screenshots and metrics: docs/evidence/1B-responsive/. Svelte check: zero errors/warnings; production build passed.

Packet 1B remains in progress pending user review. No worker launch or backend/model changes. Local preview uses the existing disposable visual-review instance.
