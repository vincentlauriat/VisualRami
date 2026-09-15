import { RANK_LABEL, SUIT_SYMBOL, type Card } from "@visualrami/shared";

interface Props {
  card: Card;
  selected?: boolean;
  dimmed?: boolean;
  order?: number;
  onClick?: () => void;
  size?: "normal" | "small";
}

export function CardView({ card, selected, dimmed, order, onClick, size = "normal" }: Props) {
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
  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={selected}
      aria-label={card.joker ? "Joker" : `${label} ${card.suit}`}
    >
      <span className="corner">
        <b>{label}</b>
        <i>{card.joker ? "★" : suit}</i>
      </span>
      <span className="center">{card.joker ? "🃏" : suit}</span>
      {order !== undefined && <span className="order">{order}</span>}
    </button>
  );
}

export function CardBack({ count, onClick, label }: { count?: number; onClick?: () => void; label?: string }) {
  return (
    <button type="button" className={`card back${onClick ? " clickable" : ""}`} onClick={onClick} disabled={!onClick}>
      <span className="back-pattern" />
      {count !== undefined && <span className="count">{count}</span>}
      {label && <span className="pile-label">{label}</span>}
    </button>
  );
}
