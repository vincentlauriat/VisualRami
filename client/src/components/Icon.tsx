// Control icons, drawn on a 24-unit grid with one stroke weight so they sit together.
// They replace emoji, whose rendering changed with every OS. Always decorative: the button
// carrying one has its own text or aria-label.

const PATHS = {
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  micOff: (
    <>
      <path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5" />
      <path d="M5.5 11a6.5 6.5 0 0 0 10.9 4.8M18.5 11a6.5 6.5 0 0 1-.4 2.2M12 17.5V21M3.5 3.5l17 17" />
    </>
  ),
  camera: (
    <>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10.5l6-3.5v10l-6-3.5" />
    </>
  ),
  cameraOff: (
    <>
      <path d="M8 6h5a2.5 2.5 0 0 1 2.5 2.5v4M15.5 15.5a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 15.5v-7A2.5 2.5 0 0 1 4.5 6" />
      <path d="M15.5 10.5l6-3.5v10l-3.2-1.9M3.5 3.5l17 17" />
    </>
  ),
  offline: <path d="M2.5 9a14 14 0 0 1 6.2-3.4M13.5 5.1A14 14 0 0 1 21.5 9M5.5 12.5a9.5 9.5 0 0 1 4.4-2.4M15.9 10.6a9.5 9.5 0 0 1 2.6 1.9M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3.5 3.5l17 17" />,
  chat: <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5v-3.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z" />,
  // A jester's cap with three bells: the joker, drawn like the other glyphs.
  joker: (
    <>
      <path d="M4.5 18.5h15M5.2 18.5c.3-4-.7-7.4-2.6-9.4 3.6-.2 6.3 1.8 7.5 5.3.3-3.8 1-6.8 1.9-8.8.9 2 1.6 5 1.9 8.8 1.2-3.5 3.9-5.5 7.5-5.3-1.9 2-2.9 5.4-2.6 9.4" />
      <circle cx="2.6" cy="8.6" r="1.3" />
      <circle cx="12" cy="4.4" r="1.3" />
      <circle cx="21.4" cy="8.6" r="1.3" />
    </>
  ),
  crown: <path d="M4 17.5h16M4.5 15l-1-8.5 4.8 3.8L12 4.5l3.7 5.8 4.8-3.8-1 8.5z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  leave: <path d="M10 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H10M14.5 8l4 4-4 4M18.5 12H9.5" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden focusable="false">
      {PATHS[name]}
    </svg>
  );
}

/**
 * The brand mark: a card face fanned over a card back. Drawn rather than the 🃏 emoji, whose
 * picture changed with every OS. The back takes the card-back blue, the only place blue is used.
 */
export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect x="2.6" y="5" width="11" height="15.5" rx="2" transform="rotate(-11 8.1 12.75)" fill="#2c4a8a" stroke="#a9c1f2" strokeWidth="1.2" />
      <g transform="rotate(9 14.5 11.5)">
        <rect x="9" y="3.75" width="11" height="15.5" rx="2" fill="#fdfdf8" stroke="#c9c9c0" strokeWidth="1" />
        <path d="M14.5 14.6c-2.5-1.7-3.4-2.9-3.4-4.1a1.7 1.7 0 0 1 3.4-.6 1.7 1.7 0 0 1 3.4.6c0 1.2-.9 2.4-3.4 4.1z" fill="#c8322b" />
      </g>
    </svg>
  );
}
