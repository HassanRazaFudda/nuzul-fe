/**
 * The inventory ledger engine.
 *
 * A TypeScript port of the engine the client validated in
 * Invoices/inventory-ledger-check.html. The logic is deliberately unchanged;
 * the only difference is the input: dates arrive as night indexes (from
 * domain/calendar), so this file knows nothing about months. One call covers
 * one pool, i.e. one (hotel, source room type).
 *
 * A range [from, to) covers nights from..to-1 (check-in to check-out).
 *
 * Trust the night grid and `need` for overbooking decisions. The `result` table
 * is a display aid: in rare shapes it shows no negative row although a night is
 * short (see docs/inventory-ledger-rules.md).
 */

export interface LedgerEntry {
  from: number;
  to: number;
  rooms: number;
}

export type LedgerMode = 'layers' | 'tree' | 'containment';

export interface LedgerResultRow {
  from: number;
  to: number;
  purchased: number;
  sold: number;
  available: number;
}

export interface LedgerNightRow {
  from: number;
  to: number;
  purchased: number;
  sold: number;
  available: number;
}

export interface LedgerNeedRow {
  from: number;
  to: number;
  buy: number;
}

export interface LedgerOutput {
  mode: LedgerMode;
  result: LedgerResultRow[];
  need: LedgerNeedRow[];
  nights: LedgerNightRow[];
}

interface Range {
  from: number;
  to: number;
}

interface Grid {
  start: number;
  purchased: number[];
  sold: number[];
  avail: number[];
  worst(from: number, to: number): number;
  firstRun(from: number, to: number, value: number): Range | null;
}

const key = (from: number, to: number) => `${from}_${to}`;
const width = (r: Range) => r.to - r.from;
const sumRooms = (list: LedgerEntry[]) => list.reduce((s, e) => s + e.rooms, 0);
/** In-range reads only; the fallback satisfies the type and is never reached. */
const at = (list: readonly number[], index: number): number => list[index] ?? 0;
const byStartThenWidest = (a: Range, b: Range) => a.from - b.from || width(b) - width(a);

// Each distinct range once, in first-entered order.
function uniqueRanges(list: Range[]): Range[] {
  const seen = new Set<string>();
  const out: Range[] = [];
  for (const e of list) {
    const k = key(e.from, e.to);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ from: e.from, to: e.to });
  }
  return out;
}

// Night-by-night purchased / sold / available, plus range queries on it.
function buildGrid(P: LedgerEntry[], S: LedgerEntry[]): Grid {
  let start = Infinity;
  let end = -Infinity;
  for (const e of [...P, ...S]) {
    start = Math.min(start, e.from);
    end = Math.max(end, e.to);
  }
  const purchased = new Array<number>(end - start).fill(0);
  const sold = new Array<number>(end - start).fill(0);
  for (const e of P)
    for (let n = e.from; n < e.to; n++) purchased[n - start] = at(purchased, n - start) + e.rooms;
  for (const e of S) for (let n = e.from; n < e.to; n++) sold[n - start] = at(sold, n - start) + e.rooms;
  const avail = purchased.map((p, i) => p - at(sold, i));
  return {
    start,
    purchased,
    sold,
    avail,
    // Tightest night in [from, to).
    worst(from, to) {
      let w = Infinity;
      for (let n = from; n < to; n++) if (at(avail, n - start) < w) w = at(avail, n - start);
      return w;
    },
    // First unbroken run of nights in [from, to) sitting at exactly `value`.
    firstRun(from, to, value) {
      let runFrom: number | null = null;
      for (let n = from; n < to; n++) {
        if (at(avail, n - start) === value) {
          runFrom ??= n;
        } else if (runFrom !== null) {
          return { from: runFrom, to: n };
        }
      }
      return runFrom === null ? null : { from: runFrom, to };
    },
  };
}

interface Row extends Range {
  available: number;
  sold?: number;
  synthetic?: boolean;
}

// ======================================================================
// Result: one of three rules, picked by the shape of the data.
//
//  1. LAYERS       no night is overbooked anywhere.
//  2. CREDIT TREE  something is short, and the widest purchase is the root
//                  of everything: every other purchase sits inside it, and
//                  no sale starts before it (or starts with it and runs
//                  longer).
//  3. CONTAINMENT  anything else, or when the tree finds nothing to split.
// ======================================================================

// 1. LAYERS: free rooms stacked from the widest range down. Each range shows
// only what it has ON TOP of the narrowest range around it. A sale cut from one
// edge of the narrowest range around it reveals the rest of that range as its
// own row, so no free room is hidden.
function layeredRows(P: LedgerEntry[], S: LedgerEntry[], grid: Grid): Row[] {
  const ranges = uniqueRanges([...P, ...S]);
  const seen = new Set(ranges.map((r) => key(r.from, r.to)));
  const around = (r: Range) => {
    let best: Range | null = null;
    for (const o of ranges) {
      if (
        o.from <= r.from &&
        o.to >= r.to &&
        width(o) > width(r) &&
        (best === null || width(o) < width(best))
      ) {
        best = o;
      }
    }
    return best;
  };
  for (const s of S) {
    const outer = around(s);
    if (!outer || (outer.from !== s.from && outer.to !== s.to)) continue;
    const rest = outer.from === s.from ? { from: s.to, to: outer.to } : { from: outer.from, to: s.from };
    if (seen.has(key(rest.from, rest.to))) continue;
    seen.add(key(rest.from, rest.to));
    ranges.push(rest);
  }
  return ranges.map((r) => {
    const outer = around(r);
    return {
      from: r.from,
      to: r.to,
      available: grid.worst(r.from, r.to) - (outer ? grid.worst(outer.from, outer.to) : 0),
    };
  });
}

// 3. CONTAINMENT: each purchase (narrowest first) covers the sales that sit
// fully inside its dates, never giving more than a night has left. Sales
// reaching outside it show their full sold figure as the shortfall. A purchase
// row shows what it has left on its tightest night.
function containmentRows(P: LedgerEntry[], S: LedgerEntry[]): Row[] {
  const need = S.map((s) => s.rooms);
  const avail: Record<string, number> = {};
  const add = (k: string, v: number) => {
    avail[k] = (avail[k] ?? 0) + v;
  };
  [...P]
    .sort((a, b) => width(a) - width(b))
    .forEach((p) => {
      const cap = new Array<number>(width(p)).fill(p.rooms);
      S.forEach((s, i) => {
        if (s.from < p.from || s.to > p.to || at(need, i) === 0) return;
        const give = Math.min(at(need, i), Math.min(...cap.slice(s.from - p.from, s.to - p.from)));
        need[i] = at(need, i) - give;
        for (let n = s.from; n < s.to; n++) cap[n - p.from] = at(cap, n - p.from) - give;
      });
      add(key(p.from, p.to), Math.min(...cap));
    });
  S.forEach((s, i) => add(key(s.from, s.to), -at(need, i)));
  return uniqueRanges([...P, ...S]).map((r) => ({
    from: r.from,
    to: r.to,
    available: avail[key(r.from, r.to)] ?? 0,
  }));
}

interface TreeNode extends Range {
  kind: 'leftover' | 'direct';
  value: number;
  established: boolean;
  siblingKey: string | null;
  chargeInvolved: boolean;
  exhausted: boolean;
  negativeExhaust: boolean;
  superseded: boolean;
  ownSaleResolved: boolean;
}

interface Tree {
  nodes: TreeNode[];
  byKey: Record<string, TreeNode>;
}

// 2a. CREDIT TREE: walk the sales in order. A sale cut from one edge of the
// narrowest open range around it (or, failing that, of the anchor purchase
// itself) opens a "leftover" for the rest of that range, holding the sale's
// rooms as credit. A later sale on exactly a leftover's range spends that
// credit; overspending charges the overage to the leftover around it (or
// replaces its sibling's value when there is none). Any other purchase only
// adds rooms to a leftover with exactly its range.
function creditTree(P: LedgerEntry[], S: LedgerEntry[], anchor: LedgerEntry, grid: Grid): Tree {
  const nodes: TreeNode[] = [];
  const byKey: Record<string, TreeNode> = {};
  const extra: Record<string, number> = {};
  for (const p of P) {
    if (p !== anchor) extra[key(p.from, p.to)] = (extra[key(p.from, p.to)] ?? 0) + p.rooms;
  }

  function addNode(
    from: number,
    to: number,
    kind: TreeNode['kind'],
    value: number,
    established: boolean,
    siblingKey: string | null,
    charged?: boolean,
  ) {
    const node: TreeNode = {
      from,
      to,
      kind,
      value,
      established,
      siblingKey,
      chargeInvolved: !!charged,
      exhausted: false,
      negativeExhaust: false,
      superseded: false,
      ownSaleResolved: false,
    };
    nodes.push(node);
    byKey[key(from, to)] = node;
  }
  function narrowest(test: (n: TreeNode) => boolean) {
    let best: TreeNode | null = null;
    for (const n of nodes) if (test(n) && (best === null || width(n) < width(best))) best = n;
    return best;
  }
  function makeLeftover(
    from: number,
    to: number,
    amount: number,
    siblingKey: string | null,
    charged?: boolean,
  ) {
    const n = byKey[key(from, to)];
    if (!n) {
      addNode(from, to, 'leftover', amount + (extra[key(from, to)] ?? 0), true, siblingKey, charged);
    } else if (n.established && !n.exhausted) {
      n.value += amount;
    }
  }
  function chargeOverage(spent: TreeNode, overage: number) {
    const outer = narrowest(
      (n) =>
        n.kind === 'leftover' &&
        n.established &&
        !n.superseded &&
        n !== spent &&
        n.from <= spent.from &&
        n.to >= spent.to,
    );
    if (outer) {
      outer.value -= overage;
      outer.chargeInvolved = true;
      const left = outer.from === spent.from;
      const from = left ? spent.to : outer.from;
      const to = left ? outer.to : spent.from;
      if (from < to) makeLeftover(from, to, overage, null, true);
      return;
    }
    const sib = spent.siblingKey ? byKey[spent.siblingKey] : undefined;
    if (sib) {
      sib.value = overage;
      sib.chargeInvolved = true;
      sib.established = true;
    }
  }

  for (const s of S) {
    const own = byKey[key(s.from, s.to)];
    if (own?.kind === 'leftover' && own.established && !own.exhausted) {
      if (s.rooms <= own.value) {
        own.value -= s.rooms;
        own.ownSaleResolved = true;
        continue;
      }
      const overage = s.rooms - own.value;
      own.exhausted = true;
      if (grid.worst(own.from, own.to) < 0) {
        own.negativeExhaust = true;
        continue;
      }
      own.value = 0;
      chargeOverage(own, overage);
      continue;
    }

    let rest: Range | null = null;
    let nested = false;
    const outer = narrowest((n) => !n.superseded && n.from <= s.from && n.to >= s.to);
    if (outer && width(outer) !== width(s) && (outer.from === s.from || outer.to === s.to)) {
      rest = outer.from === s.from ? { from: s.to, to: outer.to } : { from: outer.from, to: s.from };
      nested = true;
    }
    if (!rest) {
      const a = anchor;
      if (s.from === a.from && s.to < a.to) rest = { from: s.to, to: a.to };
      else if (s.to === a.to && s.from > a.from) rest = { from: a.from, to: s.from };
      else if (s.from > a.from && s.from < a.to && s.to > a.to) rest = { from: a.from, to: s.from };
      else if (s.to > a.from && s.to < a.to && s.from < a.from) rest = { from: s.to, to: a.to };
    }
    if (!rest || rest.from >= rest.to) continue;

    // The range this sale carved up is retired; its pieces speak for it now.
    if (nested && outer) outer.superseded = true;
    const restKey = key(rest.from, rest.to);
    if (!own) addNode(s.from, s.to, 'direct', 0, false, restKey, false);
    makeLeftover(rest.from, rest.to, s.rooms, key(s.from, s.to));

    // A true split also banks the sale as credit on every other open leftover
    // it doesn't touch.
    if (!nested) continue;
    for (const n of nodes) {
      if (key(n.from, n.to) === restKey) continue;
      if (
        n.kind === 'leftover' &&
        n.established &&
        !n.exhausted &&
        !n.superseded &&
        (s.to <= n.from || s.from >= n.to)
      ) {
        n.value += s.rooms;
      }
    }
  }
  return { nodes, byKey };
}

// 2b. Turn the tree into rows. Leftovers the tree revealed but nobody typed take
// part in the clean-up passes, and stay in the result only when their rooms are
// really there: more than 0 and no more than the tightest night they cover.
function treeRows(P: LedgerEntry[], S: LedgerEntry[], tree: Tree, grid: Grid): Row[] {
  type Candidate = Range & { synthetic?: boolean; raw: number };
  const unique = uniqueRanges([...P, ...S]) as Candidate[];
  const seen = new Set(unique.map((r) => key(r.from, r.to)));
  for (const n of tree.nodes) {
    if (n.kind !== 'leftover' || !n.established || n.superseded || seen.has(key(n.from, n.to))) {
      continue;
    }
    seen.add(key(n.from, n.to));
    unique.push({ from: n.from, to: n.to, synthetic: true, raw: 0 });
  }
  const ranges = unique;
  for (const r of ranges) r.raw = grid.worst(r.from, r.to);
  const contains = (o: Range, r: Range) => o !== r && o.from <= r.from && o.to >= r.to;

  const rows: Required<Row>[] = ranges
    .map((r) => {
      const node = tree.byKey[key(r.from, r.to)];
      // A leftover that only ever absorbed its own sale reads its true floor;
      // one built or drained by overage charges reads its credit value.
      const useCredit =
        node && node.established && !node.negativeExhaust && !(node.ownSaleResolved && !node.chargeInvolved);
      let available = useCredit ? node.value : r.raw;
      if (!useCredit) {
        if (available >= 0) {
          // A positive floor that a wider range already reports is shown there.
          if (ranges.some((o) => contains(o, r) && o.raw === available)) available = 0;
        } else {
          // A shortfall that a narrower range already reports is flagged there,
          // unless the rest of this range, beside that narrower one, has a
          // different shortfall of its own.
          const inner = ranges.find((o) => contains(r, o) && o.raw === available);
          if (inner) {
            const rest =
              inner.from === r.from
                ? { from: inner.to, to: r.to }
                : inner.to === r.to
                  ? { from: r.from, to: inner.from }
                  : null;
            const restWorst = rest && rest.from < rest.to ? grid.worst(rest.from, rest.to) : 0;
            available = restWorst < 0 ? restWorst : 0;
          }
        }
      }
      const sold = sumRooms(S.filter((e) => e.from === r.from && e.to === r.to));
      return { from: r.from, to: r.to, sold, available, synthetic: !!r.synthetic };
    })
    .sort(byStartThenWidest);

  const isRawFloor = (b: Row) => b.available === grid.worst(b.from, b.to);

  // A sale starting inside a range and running past its end can drag both to the
  // same figure. The wider range keeps only the nights before the overlap; the
  // overlapping one needs just its own rooms.
  for (const b of rows) {
    if (b.available >= 0 || !isRawFloor(b)) continue;
    const c = rows.find(
      (c) =>
        c !== b &&
        c.from > b.from &&
        c.from < b.to &&
        c.to > b.to &&
        c.available === b.available &&
        isRawFloor(c),
    );
    if (!c) continue;
    b.available = grid.worst(b.from, c.from);
    c.available = -c.sold;
  }

  // Two overbooked ranges that exactly tile a wider one: the smaller shortfall
  // moves up to the wide range and comes off the larger one, the same convention
  // "Needed to buy" uses.
  for (const parent of rows) {
    const kids = rows.filter((b) => {
      if (b === parent || b.from < parent.from || b.to > parent.to) return false;
      return !rows.some(
        (o) => o !== b && o !== parent && o.from <= b.from && o.to >= b.to && width(o) < width(parent),
      );
    });
    const [first, second] = kids;
    if (kids.length !== 2 || !first || !second || width(first) + width(second) !== width(parent)) continue;
    if (first.available >= 0 || second.available >= 0) continue;
    const small = Math.abs(first.available) <= Math.abs(second.available) ? first : second;
    const big = small === first ? second : first;
    parent.available = small.available;
    big.available += Math.abs(small.available);
    small.available = 0;
  }

  // Ranges that pass through the same worst nights with the same shortfall report
  // it once, on the range whose run of those nights is narrowest.
  const groups: Record<string, { row: Row; runWidth: number }[]> = {};
  for (const b of rows) {
    if (b.available >= 0) continue;
    const run = grid.firstRun(b.from, b.to, b.available);
    if (!run) continue;
    const k = `${run.from}_${run.to}_${b.available}`;
    (groups[k] ??= []).push({ row: b, runWidth: width(run) });
  }
  for (const g of Object.values(groups)) {
    if (g.length < 2) continue;
    const keep = g.reduce<{ row: Row; runWidth: number } | undefined>((best, x) => {
      if (!best) return x;
      if (x.runWidth !== best.runWidth) return x.runWidth < best.runWidth ? x : best;
      return width(x.row) < width(best.row) ? x : best;
    }, undefined);
    for (const x of g) if (x !== keep) x.row.available = 0;
  }

  return rows.filter((b) => !b.synthetic || (b.available > 0 && b.available <= grid.worst(b.from, b.to)));
}

// ======================================================================
// Needed to buy: straight from the nightly shortfall, independent of the Result
// rule. Walk the nights, opening a layer whenever the shortfall rises and closing
// every open layer whenever it dips; join equal neighbours. Then, when exactly
// two buys gaplessly tile a typed range, the smaller folds into that range and
// comes off the larger.
// ======================================================================
function needToBuy(P: LedgerEntry[], S: LedgerEntry[], grid: Grid): LedgerNeedRow[] {
  const rects: { from: number; to: number; buy: number }[] = [];
  const open: { height: number; from: number }[] = [];
  let total = 0;
  for (let i = 0; i <= grid.avail.length; i++) {
    const target = i < grid.avail.length ? Math.max(0, -at(grid.avail, i)) : 0;
    if (total > target) {
      for (let top = open.pop(); top; top = open.pop()) {
        rects.push({ from: top.from, to: i, buy: top.height });
      }
      total = 0;
    }
    if (total < target) {
      open.push({ height: target - total, from: i });
      total = target;
    }
  }
  rects.sort((a, b) => a.from - b.from);
  let buys: LedgerNeedRow[] = [];
  for (const r of rects) {
    const from = r.from + grid.start;
    const to = r.to + grid.start;
    const last = buys[buys.length - 1];
    if (last?.to === from && last.buy === r.buy) last.to = to;
    else buys.push({ from, to, buy: r.buy });
  }

  const typed = uniqueRanges([...P, ...S]);
  let folded = true;
  while (folded) {
    folded = false;
    for (const parent of typed) {
      if (folded) break;
      const kids = buys.filter((b) => b.from >= parent.from && b.to <= parent.to);
      const [first, second] = kids;
      if (kids.length !== 2 || !first || !second) continue;
      const touching = first.to === second.from || second.to === first.from;
      if (
        !touching ||
        Math.min(first.from, second.from) !== parent.from ||
        Math.max(first.to, second.to) !== parent.to
      ) {
        continue;
      }
      const small = first.buy <= second.buy ? first : second;
      const big = small === first ? second : first;
      big.buy -= small.buy;
      buys = buys.filter((b) => b !== small);
      buys.push({ from: parent.from, to: parent.to, buy: small.buy });
      folded = true;
    }
  }
  return buys.filter((b) => b.buy > 0).sort(byStartThenWidest);
}

/** The ledger for one pool, or null when it has no entries at all. */
export function computeLedger(input: {
  purchases: LedgerEntry[];
  sales: LedgerEntry[];
}): LedgerOutput | null {
  const P = input.purchases;
  const S = input.sales;
  if (P.length === 0 && S.length === 0) return null;

  const grid = buildGrid(P, S);
  let mode: LedgerMode;
  let rows: Row[];
  if (grid.avail.every((a) => a >= 0)) {
    mode = 'layers';
    rows = layeredRows(P, S, grid);
  } else {
    const anchor = P.reduce<LedgerEntry | null>(
      (best, p) => (best === null || width(p) > width(best) ? p : best),
      null,
    );
    const isRoot =
      anchor !== null &&
      P.every((p) => p.from >= anchor.from && p.to <= anchor.to) &&
      !S.some((s) => {
        const overlaps = s.from < anchor.to && s.to > anchor.from;
        return overlaps && (s.from < anchor.from || (s.from === anchor.from && s.to > anchor.to));
      });
    const tree = isRoot ? creditTree(P, S, anchor, grid) : null;
    if (tree && tree.nodes.length > 0) {
      mode = 'tree';
      rows = treeRows(P, S, tree, grid);
    } else {
      mode = 'containment';
      rows = containmentRows(P, S);
    }
  }

  const exactSum = (list: LedgerEntry[], r: Range) =>
    sumRooms(list.filter((e) => e.from === r.from && e.to === r.to));
  const result = rows
    .map((r) => ({
      from: r.from,
      to: r.to,
      purchased: exactSum(P, r),
      sold: exactSum(S, r),
      available: r.available,
    }))
    .sort(byStartThenWidest);

  // Night-by-night: cut at every date anyone typed; each piece is uniform.
  const cuts = [...new Set([...P, ...S].flatMap((e) => [e.from, e.to]))].sort((a, b) => a - b);
  const nights: LedgerNightRow[] = [];
  for (let c = 0; c + 1 < cuts.length; c++) {
    const i = at(cuts, c) - grid.start;
    nights.push({
      from: at(cuts, c),
      to: at(cuts, c + 1),
      purchased: at(grid.purchased, i),
      sold: at(grid.sold, i),
      available: at(grid.avail, i),
    });
  }

  return { mode, result, need: needToBuy(P, S, grid), nights };
}

export type NightState = 'available' | 'full' | 'overbooked';

/** Available above 0, fully utilised at 0, overbooked below 0. Decides every tag. */
export function nightState(available: number): NightState {
  if (available < 0) return 'overbooked';
  return available === 0 ? 'full' : 'available';
}

/** Rooms short on the worst night, from the grid. 0 means not overbooked. */
export function worstShortage(output: LedgerOutput | null): number {
  if (!output) return 0;
  return output.nights.reduce((worst, n) => Math.max(worst, -n.available), 0);
}
