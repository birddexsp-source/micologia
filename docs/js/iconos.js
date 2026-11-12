/* Iconos de línea (24×24). Se pintan con currentColor; el CSS pone el trazo. */
const s = d => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
export const I = {
  locate: s('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4" class="f"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>'),
  layers: s('<path d="M12 3.5l8.5 4.6L12 12.7 3.5 8.1z"/><path d="M3.5 12.2L12 16.8l8.5-4.6"/><path d="M3.5 16.2L12 20.8l8.5-4.6"/>'),
  flag: s('<path d="M5.5 21V4"/><path d="M5.5 4.5h11.5l-2.3 4 2.3 4H5.5"/>'),
  filter: s('<path d="M4 5h16l-6.2 7.4V18l-3.6 2v-7.6z"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>'),
  route: s('<path d="M4 11.5L20 4l-7.5 16-1.9-6.6z"/>'),
  edit: s('<path d="M4 20h4.2L19.4 8.8a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8z"/><path d="M13.5 6.5l4 4"/>'),
  seta: s('<path d="M12 4.5c-4.6 0-8 3-8 6.8 0 .5.3.7.7.7h14.6c.4 0 .7-.2.7-.7 0-3.8-3.4-6.8-8-6.8z"/><path d="M9.8 12.5v4.3c0 1.6.9 2.7 2.2 2.7s2.2-1.1 2.2-2.7v-4.3"/>'),
  aviso: s('<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.3v.2"/>'),
  libro: s('<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13"/>'),
  cal: s('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>'),
  close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
  chev: s('<path d="M9 5l7 7-7 7"/>')
};
