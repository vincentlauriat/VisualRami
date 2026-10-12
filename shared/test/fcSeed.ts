import fc from "fast-check";

/**
 * Property tests run on a fixed seed: CI gates merges, so a red build must be reproducible and
 * never a draw of the dice on an unrelated change. Explore locally with `FC_SEED=<n>` (and a
 * larger `numRuns`); fast-check prints the seed and path of any counterexample it finds.
 */
export const FC_SEED = process.env.FC_SEED ? Number(process.env.FC_SEED) : 20261013;
fc.configureGlobal({ seed: FC_SEED });
if (process.env.FC_SEED) console.log(`[fast-check] seed ${FC_SEED}`);
