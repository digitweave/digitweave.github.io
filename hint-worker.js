import { PRNG, choosePairSearch } from "./game-rules.js";

self.addEventListener("message", (event) => {
  const { gameState, pairs, seed } = event.data;
  const pair = choosePairSearch(gameState, pairs, new PRNG(seed));
  self.postMessage(pair);
});
