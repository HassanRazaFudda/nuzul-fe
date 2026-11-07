import { z } from 'zod';

import { currencySchema } from '@/features/currencies';
import { hotelSchema } from '@/features/hotels';
import { buildPools, poolLedger, type PoolPurchaseInput, type PoolSaleInput } from '@/features/inventory';
import { partnerSchema } from '@/features/partners';
import { purchasesApi } from '@/features/purchases';
import { roomTypeSchema } from '@/features/room-types';
import { ApiError } from '@/lib/api/api-error';
import { moneyLine } from '@/lib/money/money';
import { mockDb } from '@/mock-api/db';
import { pageOf } from '@/mock-api/list-query';

import { trimToFree, type Supply, type TakenRooms } from '../domain/allocation';
import { contractTotals } from '../domain/contract-totals';
import { lineTags } from '../domain/overbooking';
import {
  contractSchema,
  type Contract,
  type ContractInput,
  type ContractListParams,
  type ContractStatus,
  type ContractView,
} from './contract.schemas';

const counterSchema = z.object({ id: z.string(), value: z.number().int() });
const NUMBER_PADDING = 4;
const NUMBER_PATTERN = /(\d+)$/;

/** Everything a contract is checked against, with this contract itself left out. */
export interface ContractContext {
  purchases: PoolPurchaseInput[];
  sales: PoolSaleInput[];
  supplies: Supply[];
  taken: TakenRooms[];
}

const salesOf = (contract: Contract): PoolSaleInput[] =>
  contract.hotels.flatMap((entry, hotelIndex) =>
    entry.lines.map((line, lineIndex) => ({
      id: `${contract.id}:${String(hotelIndex)}:${String(lineIndex)}`,
      contractId: contract.id,
      reference: contract.number,
      hotelId: entry.hotelId,
      roomTypeId: line.sourceTypeId,
      checkIn: entry.checkIn,
      checkOut: entry.checkOut,
      rooms: line.rooms,
    })),
  );

const takenBy = (contract: Contract): TakenRooms[] =>
  contract.hotels.flatMap((entry) =>
    entry.lines.flatMap((line) =>
      line.allocations.map((allocation) => ({ ...allocation, roomTypeId: line.sourceTypeId })),
    ),
  );

async function suppliesFrom(
  purchases: Awaited<ReturnType<typeof purchasesApi.confirmed>>,
): Promise<Supply[]> {
  const vendors = await mockDb.list('vendors', partnerSchema);
  return purchases.flatMap((purchase) =>
    purchase.lines.map((line) => ({
      purchaseId: purchase.id,
      number: purchase.number,
      vendorName: vendors.find((vendor) => vendor.id === purchase.vendorId)?.name ?? 'Unknown vendor',
      hotelId: purchase.hotelId,
      roomTypeId: line.roomTypeId,
      checkIn: purchase.checkIn,
      checkOut: purchase.checkOut,
      rooms: line.rooms,
    })),
  );
}

async function contextFor(excludeId: string | null): Promise<ContractContext> {
  const [purchases, contracts] = await Promise.all([
    purchasesApi.confirmed(),
    mockDb.list('contracts', contractSchema),
  ]);
  const others = contracts.filter((contract) => contract.status === 'confirmed' && contract.id !== excludeId);
  return {
    purchases,
    sales: others.flatMap(salesOf),
    supplies: await suppliesFrom(purchases),
    taken: others.flatMap(takenBy),
  };
}

/** Adds names, and works out tags from current records. Only Confirmed contracts get tags. */
async function toViews(contracts: Contract[]): Promise<ContractView[]> {
  const [agents, hotels, context, allContracts] = await Promise.all([
    mockDb.list('agents', partnerSchema),
    mockDb.list('hotels', hotelSchema),
    contextFor(null),
    mockDb.list('contracts', contractSchema),
  ]);
  const pools = buildPools(context.purchases, context.sales);
  const ledgerOf = (hotelId: string, roomTypeId: string) => {
    const pool = pools.find((item) => item.hotelId === hotelId && item.roomTypeId === roomTypeId);
    return pool ? poolLedger(pool) : null;
  };
  // Each line's own allocations stay in `taken`: a vendor's free rooms are what no one holds.
  const taken = allContracts.filter((item) => item.status === 'confirmed').flatMap(takenBy);

  return contracts.map((contract) => {
    let overbooked = false;
    let needsVendor = false;
    const views = contract.hotels.map((entry) => ({
      ...entry,
      hotelName: hotels.find((hotel) => hotel.id === entry.hotelId)?.name ?? 'Unknown hotel',
      lines: entry.lines.map((line) => {
        const tags =
          contract.status === 'confirmed'
            ? lineTags(
                { ...line, hotelId: entry.hotelId, checkIn: entry.checkIn, checkOut: entry.checkOut },
                ledgerOf(entry.hotelId, line.sourceTypeId),
                context.supplies,
                taken,
              )
            : { overbooked: false, needsVendor: false };
        overbooked ||= tags.overbooked;
        needsVendor ||= tags.needsVendor;
        return {
          ...line,
          tags,
          allocations: line.allocations.map((allocation) => {
            const supply = context.supplies.find((item) => item.purchaseId === allocation.purchaseId);
            return {
              ...allocation,
              number: supply?.number ?? 'Purchase no longer confirmed',
              vendorName: supply?.vendorName ?? 'Unknown vendor',
            };
          }),
        };
      }),
    }));
    return {
      ...contract,
      agentName: agents.find((agent) => agent.id === contract.agentId)?.name ?? 'Unknown agent',
      tags: { overbooked, needsVendor },
      hotels: views,
    };
  });
}

async function takeNumber(existing: Contract[]): Promise<string> {
  const counter = await mockDb.get('counters', 'contract', counterSchema);
  // A browser upgraded from an earlier version has contracts but no counter for them yet.
  const highest = Math.max(
    0,
    ...existing.map((contract) => Number(NUMBER_PATTERN.exec(contract.number)?.[1] ?? 0)),
  );
  const value = Math.max(counter?.value ?? 0, highest) + 1;
  await mockDb.put('counters', { id: 'contract', value });
  return `CON-${String(value).padStart(NUMBER_PADDING, '0')}`;
}

/** Every figure comes from here, so a client-sent total could never be saved. */
async function priced(input: ContractInput) {
  const [currency, roomTypes] = await Promise.all([
    mockDb.get('currencies', input.currencyCode, currencySchema),
    mockDb.list('roomTypes', roomTypeSchema),
  ]);
  if (!currency) {
    throw new ApiError({ kind: 'validation', message: `${input.currencyCode} is not a known currency` });
  }
  const capacityOf = (id: string) => roomTypes.find((type) => type.id === id)?.capacity ?? 0;
  const totals = contractTotals(
    input.hotels.map((entry) => ({
      ...entry,
      lines: entry.lines.map((line) => ({ ...line, capacity: capacityOf(line.soldAsTypeId) })),
    })),
    input.mealPlan.kind === 'none' ? null : input.mealPlan.rate,
    currency.decimals,
  );
  const frozen = (amount: string) => moneyLine(amount, input.currencyCode, input.rateToPkr);
  return {
    ...input,
    roomAmount: frozen(totals.roomAmount),
    mealIncome: frozen(totals.mealIncome),
    total: frozen(totals.total),
    hotels: input.hotels.map((entry, hotelIndex) => {
      const hotelTotals = totals.hotels[hotelIndex];
      return {
        ...entry,
        roomAmount: frozen(hotelTotals?.roomAmount ?? '0'),
        mealIncome: frozen(hotelTotals?.mealIncome ?? '0'),
        total: frozen(hotelTotals?.total ?? '0'),
        lines: entry.lines.map((line, lineIndex) => {
          const lineTotals = hotelTotals?.lines[lineIndex];
          return {
            ...line,
            rate: lineTotals?.rate ?? '0',
            roomAmount: frozen(lineTotals?.roomAmount ?? '0'),
            mealIncome: frozen(lineTotals?.mealIncome ?? '0'),
          };
        }),
      };
    }),
  };
}

/** The record as stored now, or an error if someone else changed it first. */
async function current(id: string, version: number, allowed: ContractStatus): Promise<Contract> {
  const contract = await mockDb.get('contracts', id, contractSchema);
  if (!contract) throw new ApiError({ kind: 'not_found', message: 'Contract not found' });
  if (contract.version !== version || contract.status !== allowed) {
    throw new ApiError({ kind: 'conflict', message: 'This contract has changed' });
  }
  return contract;
}

export const contractsApi = {
  list: async (params: ContractListParams) => {
    const stored = await mockDb.list('contracts', contractSchema);
    const inHotel = params.hotelId
      ? stored.filter((item) => item.hotels.some((entry) => entry.hotelId === params.hotelId))
      : stored;
    const views = await toViews(inHotel);
    const count = (status: ContractStatus) => views.filter((item) => item.status === status).length;
    return {
      ...pageOf(
        views.filter((item) => item.status === params.status),
        params,
        {
          searchText: (item) =>
            `${item.number} ${item.agentName} ${item.hotels.map((entry) => entry.hotelName).join(' ')}`,
          sortValue: {
            number: (item) => item.number,
            date: (item) => item.date,
            agent: (item) => item.agentName,
          },
        },
      ),
      counts: { draft: count('draft'), confirmed: count('confirmed'), cancelled: count('cancelled') },
    };
  },

  get: async (id: string): Promise<ContractView> => {
    const contract = await mockDb.get('contracts', id, contractSchema);
    if (!contract) throw new ApiError({ kind: 'not_found', message: 'Contract not found' });
    const [view] = await toViews([contract]);
    if (!view) throw new ApiError({ kind: 'not_found', message: 'Contract not found' });
    return view;
  },

  context: contextFor,

  create: async (input: ContractInput) => {
    const existing = await mockDb.list('contracts', contractSchema);
    const record: Contract = {
      ...(await priced(input)),
      id: crypto.randomUUID(),
      number: await takeNumber(existing),
      status: 'draft',
      version: 1,
    };
    return mockDb.put('contracts', record);
  },

  update: async (id: string, version: number, input: ContractInput) => {
    const contract = await current(id, version, 'draft');
    return mockDb.put('contracts', { ...contract, ...(await priced(input)), version: version + 1 });
  },

  /**
   * Free rooms can have gone since the draft was saved. Any excess becomes Unallocated, and
   * `trimmedRooms` says so. The contract is confirmed either way.
   */
  confirm: async (id: string, version: number) => {
    const contract = await current(id, version, 'draft');
    const context = await contextFor(id);
    const running: TakenRooms[] = [...context.taken];
    let trimmedRooms = 0;
    const hotels = contract.hotels.map((entry) => ({
      ...entry,
      lines: entry.lines.map((line) => {
        const trimmed = trimToFree(line.allocations, line.sourceTypeId, context.supplies, running);
        trimmedRooms += trimmed.trimmedRooms;
        running.push(
          ...trimmed.allocations.map((allocation) => ({ ...allocation, roomTypeId: line.sourceTypeId })),
        );
        return { ...line, allocations: trimmed.allocations };
      }),
    }));
    const saved = await mockDb.put('contracts', {
      ...contract,
      hotels,
      status: 'confirmed',
      version: version + 1,
    });
    return { contract: saved, trimmedRooms };
  },

  cancel: async (id: string, version: number) => {
    const contract = await current(id, version, 'confirmed');
    return mockDb.put('contracts', { ...contract, status: 'cancelled', version: version + 1 });
  },

  /** Only a Draft can be deleted. A Confirmed contract is cancelled, and stays on record. */
  remove: async (id: string, version: number) => {
    await current(id, version, 'draft');
    await mockDb.remove('contracts', id);
  },
};
