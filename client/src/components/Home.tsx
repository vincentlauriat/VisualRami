import { useState, type FormEvent } from "react";
import { DEFAULT_OPTIONS, type GameOptions } from "@visualrami/shared";
import { loadName, saveName } from "../lib/socket";

interface Props {
  connected: boolean;
  initialCode?: string;
  onCreate: (name: string, options: Partial<GameOptions>) => Promise<void>;
  onJoin: (roomId: string, name: string) => Promise<void>;
}

export function Home({ connected, initialCode, onCreate, onJoin }: Props) {
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState(initialCode ?? "");
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

  return (
    <main className="home">
      <header className="home-hero">
        <h1>
          <span className="logo">🃏</span> VisualRami
        </h1>
        <p>Le Rami 51 entre amis, avec la visio et le son de chaque joueur autour de la table.</p>
      </header>

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
        </ul>
      </section>
    </main>
  );
}
