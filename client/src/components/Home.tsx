import { useState, type FormEvent } from "react";
import { DEFAULT_OPTIONS, type BotLevel, type GameOptions } from "@visualrami/shared";
import { forgetSeat, loadName, loadSeats, saveName } from "../lib/socket";
import { labels } from "../lib/labels";
import { MAX_MIN_POINTS, readMinPoints } from "../lib/minPoints";
import { Icon, Mark } from "./Icon";
import { Rules } from "./Rules";

interface Props {
  connected: boolean;
  initialCode?: string;
  onCreate: (name: string, options: Partial<GameOptions>) => Promise<void>;
  onSolo: (name: string, bots: number, options: Partial<GameOptions>, level: BotLevel) => Promise<void>;
  onJoin: (roomId: string, name: string) => Promise<void>;
  onResume: (roomId: string, name: string) => Promise<void>;
}

function formatAge(ts: number): string {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

type Where = "invite" | "resume" | "create" | "join" | "solo";

export function Home({ connected, initialCode, onCreate, onSolo, onJoin, onResume }: Props) {
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState(initialCode?.toUpperCase() ?? "");
  const [seats, setSeats] = useState(() => loadSeats());
  const [minPoints, setMinPoints] = useState(DEFAULT_OPTIONS.firstMeldMinPoints);
  // What the field shows while typing; `minPoints` is the last valid value, the one sent.
  const [minPointsText, setMinPointsText] = useState(String(DEFAULT_OPTIONS.firstMeldMinPoints));
  const [pureRun, setPureRun] = useState(DEFAULT_OPTIONS.requirePureRun);
  const [soloBots, setSoloBots] = useState(1);
  const [soloLevel, setSoloLevel] = useState<BotLevel>("easy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ where: Where; text: string } | null>(null);
  // Arriving by an invitation link shows that one table; the full home is a click away.
  const [invite, setInvite] = useState(!!initialCode);
  const [createOpen, setCreateOpen] = useState(false);

  const ready = name.trim().length > 0 && connected && !busy;
  const inviteCode = initialCode?.toUpperCase() ?? "";
  const inviteSeat = seats.find((s) => s.roomId === inviteCode);
  // One gold button, the action this visitor most likely came for: a code they typed, else a
  // seat they hold, else a new table.
  const primary: Where = code.trim().length === 5 ? "join" : seats.length > 0 ? "resume" : "create";

  async function run(where: Where, fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    saveName(name.trim());
    try {
      await fn();
    } catch (err) {
      const text = (err as Error).message;
      setError({ where, text: text === "Table introuvable" ? labels.tableNotFound : text });
    } finally {
      setBusy(false);
    }
  }

  function submitJoin(e: FormEvent, where: Where, roomId: string) {
    e.preventDefault();
    if (!ready || !roomId.trim()) return;
    void run(where, () => onJoin(roomId.trim().toUpperCase(), name.trim()));
  }

  function forget(roomId: string) {
    forgetSeat(roomId);
    setSeats(loadSeats());
  }

  function leaveInvite() {
    setInvite(false);
    setError(null);
  }

  const errorAt = (where: Where) =>
    error?.where === where && (
      <p className="hint error" role="alert">
        {error.text}
      </p>
    );

  // The table's rules: shared by a new table and a game against the computer.
  const optionFields = (
    <>
      <label className="field">
        <span>Points minimum pour la première pose</span>
        <input
          type="number"
          min={0}
          max={MAX_MIN_POINTS}
          value={minPointsText}
          onChange={(e) => {
            setMinPointsText(e.target.value);
            setMinPoints((last) => readMinPoints(e.target.value, last));
          }}
          onBlur={() => setMinPointsText(String(minPoints))}
        />
      </label>
      <label className="field check">
        <input type="checkbox" checked={pureRun} onChange={(e) => setPureRun(e.target.checked)} />
        <span>Tierce franche obligatoire à la première pose</span>
      </label>
    </>
  );

  const createPanel = (gold: boolean, withOptions = true) => (
    <section className="panel">
      <h2>Créer une table</h2>
      {withOptions ? optionFields : <p className="hint">Vous recevez ensuite un code à cinq lettres à envoyer à vos amis.</p>}
      <button
        type="button"
        className={gold ? "primary" : undefined}
        disabled={!ready}
        onClick={() => run("create", () => onCreate(name.trim(), { firstMeldMinPoints: minPoints, requirePureRun: pureRun }))}
      >
        Créer la table
      </button>
      {errorAt("create")}
    </section>
  );

  const nameField = (
    <label className="field">
      <span>Votre prénom</span>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Ex. Vincent" autoFocus />
    </label>
  );

  if (invite) {
    const notFound = error?.where === "invite" && error.text === labels.tableNotFound;
    return (
      <main className="home invite">
        <header className="home-hero">
          <h1>
            <span className="logo"><Mark /></span> VisualRami
          </h1>
        </header>

        <section className="panel invite-card" aria-labelledby="invite-title">
          {inviteSeat ? (
            <>
              <h2 id="invite-title">
                Reprendre la table <span className="room-code small">{inviteCode}</span>
              </h2>
              <p className="hint">
                Votre place est gardée, au prénom de {inviteSeat.name} · {formatAge(inviteSeat.savedAt)}.
              </p>
              <button
                type="button"
                className="primary"
                disabled={!connected || busy}
                onClick={() => run("invite", () => onResume(inviteSeat.roomId, inviteSeat.name))}
              >
                Reprendre
              </button>
            </>
          ) : (
            <form onSubmit={(e) => submitJoin(e, "invite", inviteCode)}>
              <h2 id="invite-title">
                Rejoindre la table <span className="room-code small">{inviteCode}</span>
              </h2>
              {nameField}
              <button type="submit" className="primary" disabled={!ready}>
                Rejoindre la table
              </button>
            </form>
          )}
          {!connected && <p className="hint warn">Connexion au serveur…</p>}
          {errorAt("invite")}
        </section>

        <p className="invite-alt">
          {notFound && (
            <button type="button" className="link" onClick={leaveInvite}>
              Saisir un autre code
            </button>
          )}
          <button type="button" className="link" aria-expanded={createOpen} onClick={() => setCreateOpen((v) => !v)}>
            Créer une autre table
          </button>
        </p>
        {createOpen && (
          <>
            {inviteSeat && <section className="panel">{nameField}</section>}
            {createPanel(false)}
          </>
        )}
      </main>
    );
  }

  return (
    <main className="home home-wide">
      <div className="home-split">
      <div className="home-left">
      <header className="home-hero">
        <h1>
          <span className="logo"><Mark /></span> VisualRami
        </h1>
        <p className="home-lede">{labels.homeLede}</p>
        <p className="home-sub">{labels.homeSub}</p>
        <ul className="home-facts">
          {labels.homeFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </header>

      {/* The game in 25 seconds, for whoever arrives with nobody to explain it. Nothing loads until
          play is pressed (the poster is a real frame of a table); native controls, so it is not a
          second gold button. On a phone it sits after the way in, which comes first. */}
      <figure className="home-video">
        <video
          controls
          preload="none"
          playsInline
          width={1280}
          height={720}
          poster="/presentation-poster.webp"
          aria-label={labels.homeVideoLabel}
        >
          <source src="/presentation.mp4" type="video/mp4" />
          {labels.homeVideoFallback}
        </video>
        <figcaption>{labels.homeVideoCaption}</figcaption>
      </figure>
      </div>

      <div className="home-flow">
      {seats.length > 0 && (
        <section className="panel seats">
          <h2>Reprendre une partie</h2>
          <ul className="seat-list">
            {seats.map((seat, i) => (
              <li key={seat.roomId}>
                <span className="room-code small">{seat.roomId}</span>
                <span className="seat-meta">
                  {seat.name} · {formatAge(seat.savedAt)}
                </span>
                <button
                  type="button"
                  className={primary === "resume" && i === 0 ? "primary" : undefined}
                  disabled={!connected || busy}
                  onClick={() => run("resume", () => onResume(seat.roomId, seat.name))}
                >
                  Reprendre
                </button>
                <button type="button" className="ghost tiny" onClick={() => forget(seat.roomId)} aria-label="Oublier">
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
          {errorAt("resume")}
          <p className="hint">Les parties commencées restent ouvertes 7 jours. Depuis un autre appareil, entrez le code et le même prénom.</p>
        </section>
      )}

      <section className="panel">
        {nameField}
        {!connected && <p className="hint warn">Connexion au serveur…</p>}
      </section>

      <details className="panel table-options">
        <summary>
          <span>Règles de la table</span>
          <span className="options-now">
            {minPoints} points{pureRun ? ", tierce franche" : ""}
          </span>
        </summary>
        {optionFields}
      </details>

      <div className="home-columns">
        {createPanel(primary === "create", false)}

        <form className="panel" onSubmit={(e) => submitJoin(e, "join", code)}>
          <h2>Rejoindre une table</h2>
          <label className="field">
            <span>Code de la table</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={5}
              placeholder="ABCDE"
              className="code-input"
              aria-describedby={error?.where === "join" ? "join-error" : undefined}
            />
          </label>
          {error?.where === "join" && (
            <p className="hint error" id="join-error" role="alert">
              {error.text}
            </p>
          )}
          <button type="submit" className={primary === "join" ? "primary" : undefined} disabled={!ready || code.trim().length < 5}>
            Rejoindre
          </button>
        </form>
      </div>

      {/* Discreet on purpose: one gold button on the page (The Lamp Rule). The table rules above
          apply here too. */}
      <section className="panel solo" aria-labelledby="solo-title">
        <h2 id="solo-title">{labels.soloTitle}</h2>
        <fieldset className="choice">
          <legend>{labels.soloLegend}</legend>
          {[1, 2, 3].map((n) => (
            <label key={n} className={soloBots === n ? "on" : undefined}>
              <input type="radio" name="solo-bots" value={n} checked={soloBots === n} onChange={() => setSoloBots(n)} />
              {labels.soloOpponents(n)}
            </label>
          ))}
        </fieldset>
        <fieldset className="choice">
          <legend>{labels.botLevelLegend}</legend>
          {(["easy", "medium"] as const).map((level) => (
            <label key={level} className={soloLevel === level ? "on" : undefined}>
              <input type="radio" name="solo-level" value={level} checked={soloLevel === level} onChange={() => setSoloLevel(level)} />
              {labels.botLevels[level]}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          disabled={!ready}
          onClick={() =>
            run("solo", () =>
              onSolo(name.trim(), soloBots, { firstMeldMinPoints: minPoints, requirePureRun: pureRun }, soloLevel),
            )
          }
        >
          <Icon name="bot" />
          {labels.soloStart}
        </button>
        {errorAt("solo")}
      </section>

      </div>
      </div>

      <section className="panel rules">
        <h2>Règles en bref</h2>
        <Rules options={DEFAULT_OPTIONS} home />
      </section>
    </main>
  );
}
