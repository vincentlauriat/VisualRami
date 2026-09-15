import { useState, type FormEvent } from "react";
import { DEFAULT_OPTIONS, type GameOptions } from "@visualrami/shared";
import { forgetSeat, loadName, loadSeats, saveName } from "../lib/socket";

interface Props {
  connected: boolean;
  initialCode?: string;
  onCreate: (name: string, options: Partial<GameOptions>) => Promise<void>;
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

export function Home({ connected, initialCode, onCreate, onJoin, onResume }: Props) {
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState(initialCode ?? "");
  const [seats, setSeats] = useState(() => loadSeats());
  const [minPoints, setMinPoints] = useState(DEFAULT_OPTIONS.firstMeldMinPoints);
  const [pureRun, setPureRun] = useState(DEFAULT_OPTIONS.requirePureRun);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim().length > 0 && connected && !busy;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    saveName(name.trim());
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submitJoin(e: FormEvent) {
    e.preventDefault();
    if (!ready || !code.trim()) return;
    void run(() => onJoin(code.trim().toUpperCase(), name.trim()));
  }

  function forget(roomId: string) {
    forgetSeat(roomId);
    setSeats(loadSeats());
  }

  return (
    <main className="home">
      <header className="home-hero">
        <h1>
          <span className="logo">🃏</span> VisualRami
        </h1>
        <p>Le Rami 51 entre amis, avec la visio et le son de chaque joueur autour de la table.</p>
      </header>

      {seats.length > 0 && (
        <section className="panel seats">
          <h2>Reprendre une partie</h2>
          <ul className="seat-list">
            {seats.map((seat) => (
              <li key={seat.roomId}>
                <span className="room-code small">{seat.roomId}</span>
                <span className="seat-meta">
                  {seat.name} · {formatAge(seat.savedAt)}
                </span>
                <button
                  type="button"
                  className="primary"
                  disabled={!connected || busy}
                  onClick={() => run(() => onResume(seat.roomId, seat.name))}
                >
                  Reprendre
                </button>
                <button type="button" className="ghost tiny" onClick={() => forget(seat.roomId)} aria-label="Oublier">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <p className="hint">Les parties commencées restent ouvertes 7 jours. Depuis un autre appareil, entrez le code et le même prénom.</p>
        </section>
      )}

      <section className="panel">
        <label className="field">
          <span>Votre prénom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Ex. Vincent"
            autoFocus
          />
        </label>
        {!connected && <p className="hint warn">Connexion au serveur…</p>}
        {error && <p className="hint error">{error}</p>}
      </section>

      <div className="home-columns">
        <section className="panel">
          <h2>Créer une table</h2>
          <label className="field">
            <span>Points minimum pour la première pose</span>
            <input
              type="number"
              min={0}
              max={200}
              value={minPoints}
              onChange={(e) => setMinPoints(Number(e.target.value))}
            />
          </label>
          <label className="field check">
            <input type="checkbox" checked={pureRun} onChange={(e) => setPureRun(e.target.checked)} />
            <span>Tierce franche obligatoire à la première pose</span>
          </label>
          <button
            type="button"
            className="primary"
            disabled={!ready}
            onClick={() =>
              run(() => onCreate(name.trim(), { firstMeldMinPoints: minPoints, requirePureRun: pureRun }))
            }
          >
            Créer la table
          </button>
        </section>

        <form className="panel" onSubmit={submitJoin}>
          <h2>Rejoindre une table</h2>
          <label className="field">
            <span>Code de la table</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={5}
              placeholder="ABCDE"
              className="code-input"
            />
          </label>
          <button type="submit" className="primary" disabled={!ready || code.trim().length < 5}>
            Rejoindre
          </button>
        </form>
      </div>

      <section className="panel rules">
        <h2>Règles en bref</h2>
        <ul>
          <li>2 à 6 joueurs, deux jeux de 52 cartes et 4 jokers, 14 cartes chacun.</li>
          <li>À son tour : piocher (talon ou défausse), poser, puis défausser une carte.</li>
          <li>Combinaisons : suites de 3+ cartes de même couleur, ou brelans/carrés de même valeur.</li>
          <li>Première pose : au moins 51 points, avec une tierce franche (suite sans joker).</li>
          <li>Une fois posé, on complète les combinaisons de tous et on récupère les jokers.</li>
          <li>Gagne la manche qui défausse sa dernière carte. Les autres marquent leurs cartes en main (×2 sans pose).</li>
          <li>Une partie commencée reste ouverte 7 jours : revenez avec le code de la table et votre prénom.</li>
        </ul>
      </section>
    </main>
  );
}
