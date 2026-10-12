import { RANK_LABEL, SUIT_SYMBOL, type Card } from "@visualrami/shared";
import { cardName } from "../lib/cardNames";
import { labels } from "../lib/labels";
import { Icon } from "./Icon";

interface Props {
  card: Card;
  selected?: boolean;
  dimmed?: boolean;
  order?: number;
  onClick?: () => void;
  /** Accessible name when the card's role matters more than its face (e.g. "Défausse : 7 de cœur"). */
  spokenName?: string;
  size?: "normal" | "small";
  /** The card you just drew this turn: a quiet mark, not the lamp's gold. */
  drawn?: boolean;
}

export function CardView({ card, selected, dimmed, order, onClick, spokenName, size = "normal", drawn }: Props) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  const classes = [
    "card",
    size,
    red ? "red" : "black",
    card.joker ? "joker" : "",
    selected ? "selected" : "",
    dimmed ? "dimmed" : "",
    onClick ? "clickable" : "",
    drawn ? "drawn" : "",
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
      <span className="center" aria-hidden>{card.joker ? <Icon name="joker" /> : suit}</span>
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

  const base = spokenName ?? (order !== undefined ? labels.selectedCard(card, order) : cardName(card));
  const name = drawn ? `${base}, ${labels.justDrawn}` : base;
  return (
    <button type="button" className={classes} onClick={onClick} aria-pressed={spokenName ? undefined : selected} aria-label={name}>
      {face}
    </button>
  );
}

/** The stock. `endsRound`: empty with no reshuffle left, so drawing there ends the round. */
export function CardBack({ count, onClick, endsRound = false }: { count: number; onClick?: () => void; endsRound?: boolean }) {
  const name = labels.stock(count, !!onClick, endsRound);
  const classes = `card back${onClick ? " clickable" : ""}${endsRound ? " ends-round" : ""}`;
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
