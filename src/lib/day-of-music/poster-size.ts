// poster-size.ts — the share posters' layout width, shared by the modal
// preview (PosterFit), the PNG export stage (save-card.ts) and the public /s
// page's frame. Dependency-free so the server-rendered /s page can import it.

/** Width every share poster is laid out at. The stylesheet's --dom-modal-w
 *  (day-of-music.css) must match: it sizes the share modals around it. */
export const POSTER_WIDTH = 1100;
