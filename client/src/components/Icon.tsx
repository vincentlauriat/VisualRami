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
