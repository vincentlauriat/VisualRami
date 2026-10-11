import { RANK_LABEL, SUIT_SYMBOL, type Card } from "@visualrami/shared";
import { cardName } from "../lib/cardNames";
import { labels } from "../lib/labels";

interface Props {
  card: Card;
  selected?: boolean;
  dimmed?: boolean;
  order?: number;
  onClick?: () => void;
  /** Accessible name when the card's role matters more than its face (e.g. "Défausse : 7 de cœur"). */
  spokenName?: string;
  size?: "normal" | "small";
}

export function CardView({ card, selected, dimmed, order, onClick, spokenName, size = "normal" }: Props) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  const classes = [
    "card",
    size,
    red ? "red" : "black",
    card.joker ? "joker" : "",
    selected ? "selected" : "",
    dimmed ? "dimmed" : "",
    onClick ? "clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const label = card.joker ? "★" : RANK_LABEL[card.rank!];
  const suit = card.joker ? "JOKER" : SUIT_SYMBOL[card.suit!];
  const face = (
    <>
      <span className="corner" aria-hidden>
        <b>{label}</b>
        <i>{card.joker ? "★" : suit}</i>
      </span>
      <span className="center" aria-hidden>{card.joker ? "🃏" : suit}</span>
      {order !== undefined && <span className="order" aria-hidden>{order}</span>}
    </>
  );

  // A card nobody can act on is a picture, not a disabled control: melds on the table and in the
  // staging area are then free to be buttons themselves without nesting interactive content.
  if (!onClick) {
    return (
      <span className={classes} role="img" aria-label={spokenName ?? cardName(card)}>
        {face}
      </span>
    );
  }

  const name = spokenName ?? (order !== undefined ? labels.selectedCard(card, order) : cardName(card));
  return (
    <button type="button" className={classes} onClick={onClick} aria-pressed={spokenName ? undefined : selected} aria-label={name}>
      {face}
    </button>
  );
}

export function CardBack({ count, onClick }: { count: number; onClick?: () => void }) {
  const name = labels.stock(count, !!onClick);
  const classes = `card back${onClick ? " clickable" : ""}`;
  const inner = (
    <>
      <span className="back-pattern" />
      <span className="count" aria-hidden>{count}</span>
    </>
  );
  if (!onClick) {
    return (
      <span className={classes} role="img" aria-label={name}>
        {inner}
      </span>
    );
  }
  return (
    <button type="button" className={classes} onClick={onClick} aria-label={name}>
      {inner}
    </button>
  );
}
