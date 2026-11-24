export class PRNG {
  constructor(seed = 1337) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x9e3779b9;
    }
  }

  next() {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(maxExclusive) {
    return Math.floor(this.next() * maxExclusive);
  }

  fork() {
    return new PRNG(this.nextInt(0xffffffff));
  }
}


export function cloneState(gameState) {
  return {
    ...gameState,
    cells: gameState.cells.map((cell) => ({ digit: cell.digit, crossed: cell.crossed })),
  };
}

export function remainingCount(gameState) {
  return gameState.cells.reduce((total, cell) => total + (cell.crossed ? 0 : 1), 0);
}

function remainingDigits(gameState) {
  return gameState.cells.filter((cell) => !cell.crossed).map((cell) => cell.digit);
}

export function isMatch(left, right) {
  return left === right || left + right === 10;
}

export function scanVisible(gameState, startIndex, step) {
  for (let index = startIndex + step; index >= 0 && index < gameState.cells.length; index += step) {
    if (!gameState.cells[index].crossed) {
      return index;
    }
  }
  return null;
}

export function findPairs(gameState) {
  /** @type {{ first: number; second: number; direction: "right" | "down"; reason: "equal" | "sum10" }[]} */
  const pairs = [];
  const seen = new Set();
  const scans = [
    { direction: "right", step: 1 },
    { direction: "down", step: gameState.width },
  ];

  for (let index = 0; index < gameState.cells.length; index += 1) {
    const cell = gameState.cells[index];
    if (cell.crossed) {
      continue;
    }

    for (const { direction, step } of scans) {
      const neighbor = scanVisible(gameState, index, step);
      if (neighbor === null) {
        continue;
      }

      const key = `${index}:${neighbor}`;
      if (seen.has(key)) {
        continue;
      }
      const left = gameState.cells[index].digit;
      const right = gameState.cells[neighbor].digit;
      if (!isMatch(left, right)) {
        continue;
      }

      pairs.push({
        first: index,
        second: neighbor,
        direction,
        reason: left === right ? "equal" : "sum10",
      });
      seen.add(key);
    }
  }

  return pairs;
}

export function pairKey(first, second) {
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

export function crossPairIndices(gameState, first, second, forceInvalid = false) {
  if (first === second) {
    throw new Error("Select two different cells.");
  }
  const firstCell = gameState.cells[first];
  const secondCell = gameState.cells[second];
  if (!firstCell || !secondCell) {
    throw new Error("Selected pair is out of bounds.");
  }
  if (firstCell.crossed || secondCell.crossed) {
    throw new Error("Selected cells are already crossed.");
  }
  if (!forceInvalid && !isMatch(firstCell.digit, secondCell.digit)) {
    throw new Error("Pair digits must be equal or sum to 10.");
  }
  firstCell.crossed = true;
  secondCell.crossed = true;
  gameState.pairMoves += 1;
  if (forceInvalid) {
    gameState.invalidPairMoves += 1;
  } else {
    gameState.validPairMoves += 1;
  }
}

export function appendRemainingDigits(gameState) {
  const digits = remainingDigits(gameState);
  if (digits.length === 0) {
    return 0;
  }
  for (const digit of digits) {
    gameState.cells.push({ digit, crossed: false });
  }
  gameState.appendSteps += 1;
  return digits.length;
}

function choosePairFirst(pairs) {
  return pairs[0];
}

function choosePairMaxFuture(gameState, pairs, randomizer) {
  let bestScore = -1;
  let bestCandidates = [pairs[0]];
  for (const pair of pairs) {
    const simulated = cloneState(gameState);
    crossPairIndices(simulated, pair.first, pair.second);
    const score = findPairs(simulated).length;
    if (score > bestScore) {
      bestScore = score;
      bestCandidates = [pair];
    } else if (score === bestScore) {
      bestCandidates.push(pair);
    }
  }
  if (bestCandidates.length === 1) {
    return bestCandidates[0];
  }
  return bestCandidates[randomizer.nextInt(bestCandidates.length)];
}

function rolloutScore(baseState, randomizer, maxMoves, maxAppends) {
  const simulated = cloneState(baseState);
  let moves = 0;
  let appends = 0;

  while (moves < maxMoves) {
    const pairs = findPairs(simulated);
    if (pairs.length > 0) {
      const pair = choosePairMaxFuture(simulated, pairs, randomizer);
      crossPairIndices(simulated, pair.first, pair.second);
      moves += 1;
      continue;
    }

    if (remainingCount(simulated) === 0) {
      return 100000 - appends * 100 - moves;
    }
    if (appends >= maxAppends) {
      break;
    }
    const added = appendRemainingDigits(simulated);
    appends += 1;
    if (added === 0 || findPairs(simulated).length === 0) {
      break;
    }
  }

  return -(
    remainingCount(simulated) +
    appends * 15 +
    simulated.cells.length * 0.05
  );
}

export function choosePairSearch(gameState, pairs, randomizer) {
  if (pairs.length === 1) {
    return pairs[0];
  }

  let rolloutCount;
  let rolloutMoves;
  let rolloutAppends;
  if (gameState.cells.length <= 180) {
    rolloutCount = 7;
    rolloutMoves = 70;
    rolloutAppends = 2;
  } else if (gameState.cells.length <= 400) {
    rolloutCount = 5;
    rolloutMoves = 45;
    rolloutAppends = 2;
  } else {
    rolloutCount = 3;
    rolloutMoves = 30;
    rolloutAppends = 1;
  }

  const candidates = pairs
    .map((pair) => {
      const simulated = cloneState(gameState);
      crossPairIndices(simulated, pair.first, pair.second);
      return {
        pair,
        immediateScore: findPairs(simulated).length,
      };
    })
    .sort((left, right) => right.immediateScore - left.immediateScore)
    .slice(0, 6);

  let bestPair = candidates[0].pair;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const simulated = cloneState(gameState);
    crossPairIndices(simulated, candidate.pair.first, candidate.pair.second);
    let total = candidate.immediateScore * 0.5;
    for (let index = 0; index < rolloutCount; index += 1) {
      total += rolloutScore(
        simulated,
        randomizer.fork(),
        rolloutMoves,
        rolloutAppends,
      );
    }
    const average = total / (rolloutCount + 0.5);
    if (average > bestScore) {
      bestScore = average;
      bestPair = candidate.pair;
    }
  }
  return bestPair;
}

export function choosePair(gameState, pairs, strategy, randomizer) {
  if (strategy === "first") {
    return choosePairFirst(pairs);
  }
  if (strategy === "max-future") {
    return choosePairMaxFuture(gameState, pairs, randomizer);
  }
  return choosePairSearch(gameState, pairs, randomizer);
}
