import type { GameOptions } from "@visualrami/shared";

interface Props {
  options: GameOptions;
  /** The home page adds what only matters before sitting down (table size, coming back later). */
  home?: boolean;
}

/** "Première pose" as this table plays it. */
function firstLaydown({ firstMeldMinPoints: min, requirePureRun: pure }: GameOptions): string {
  if (min > 0 && pure) return `au moins ${min} points, dont une tierce franche (une suite sans joker).`;
  if (min > 0) return `au moins ${min} points, sans tierce franche obligatoire.`;
  if (pure) return "sans minimum de points, mais avec une tierce franche (une suite sans joker).";
  return "sans minimum de points ni tierce franche.";
}

/**
 * The rules in short sentences, one source for the home page and the table's Règles tab. At the
 * table they follow the room's real options.
 */
export function Rules({ options, home }: Props) {
  return (
    <ul className="rule-list">
      {home && (
        <li>
          <b>Table :</b> 2 à 6 joueurs, deux jeux de 52 cartes et 4 jokers, 14 cartes chacun.
        </li>
      )}
      <li>
        <b>À son tour :</b> piocher (talon ou défausse), poser, puis défausser une carte.
      </li>
      <li>
        <b>Combinaisons :</b> une suite de 3 cartes ou plus de même couleur, ou un brelan ou carré de même valeur.
      </li>
      <li>
        <b>Première pose :</b> {firstLaydown(options)}
      </li>
      <li>
        <b>Valeurs :</b> as 11 (1 en bas de suite), figures et 10 : 10, les autres leur chiffre.
      </li>
      <li>
        <b>Joker :</b> il vaut la carte qu'il remplace. Une fois posé, on le reprend avec la vraie carte.
      </li>
      <li>
        <b>Après la pose :</b> on complète les combinaisons de tous les joueurs.
      </li>
      <li>
        <b>Fin de manche :</b> elle s'arrête sur la dernière défausse. Les autres comptent leur main
        (joker 20), ×2 pour qui n'a rien posé.
      </li>
      {home && (
        <li>
          <b>Revenir :</b> une partie reste ouverte 7 jours. Le code de la table et votre prénom suffisent.
        </li>
      )}
    </ul>
  );
}
