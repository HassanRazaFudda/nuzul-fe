import { contractSchema, type Contract } from '@/features/contracts';
import { currencySchema, exchangeRateSchema } from '@/features/currencies';
import { hotelSchema } from '@/features/hotels';
import { countingPurchases } from '@/features/inventory';
import { partnerSchema } from '@/features/partners';
import { adjustmentSchema, purchaseSchema } from '@/features/purchases';
import { roomTypeSchema } from '@/features/room-types';
import { ApiError } from '@/lib/api/api-error';
import { nightsBetween } from '@/lib/format/dates';
import { dec, roundTo } from '@/lib/money/money';
import { mockDb } from '@/mock-api/db';
import { assertCan } from '@/mock-api/session';

import { converter, MissingRateError, type Convert } from '../domain/currency';
import { nightFacts, type PurchaseRecord, type SaleRecord } from '../domain/night-facts';
import {
  contractProfit,
  dateInRange,
  inventoryRows,
  profitAndLoss,
  salesRows,
  vendorMargin,
} from '../domain/reports';
import type { ReportParams, SalesParams } from './report.schemas';

const DEFAULT_DECIMALS = 2;

function salesOf(contract: Contract): SaleRecord[] {
  return contract.hotels.flatMap((entry, hotelIndex) =>
    entry.lines.map((line, lineIndex) => ({
      id: `${contract.id}:${String(hotelIndex)}:${String(lineIndex)}`,
      contractId: contract.id,
      number: contract.number,
      date: contract.date,
      agentId: contract.agentId,
      hotelId: entry.hotelId,
      soldAsTypeId: line.soldAsTypeId,
      sourceTypeId: line.sourceTypeId,
      checkIn: entry.checkIn,
      checkOut: entry.checkOut,
      rooms: line.rooms,
      personsPerRoom: line.personsPerRoom,
      roomAmount: line.roomAmount,
      mealIncome: line.mealIncome,
      allocations: line.allocations,
    })),
  );
}

/** Everything a report reads, as the server would load it. */
async function load() {
  const [purchases, contracts, adjustments, rates, currencies, hotels, vendors, agents, roomTypes] =
    await Promise.all([
      mockDb.list('purchases', purchaseSchema),
      mockDb.list('contracts', contractSchema),
      mockDb.list('adjustments', adjustmentSchema),
      mockDb.list('exchangeRates', exchangeRateSchema),
      mockDb.list('currencies', currencySchema),
      mockDb.list('hotels', hotelSchema),
      mockDb.list('vendors', partnerSchema),
      mockDb.list('agents', partnerSchema),
      mockDb.list('roomTypes', roomTypeSchema),
    ]);
  const purchaseRecords: PurchaseRecord[] = countingPurchases(purchases).map((purchase) => {
    const bought = purchases.find((item) => item.id === purchase.id) ?? purchase;
    return {
      id: purchase.id,
      number: purchase.number,
      vendorId: purchase.vendorId,
      hotelId: purchase.hotelId,
      checkIn: purchase.checkIn,
      checkOut: purchase.checkOut,
      boughtNights: nightsBetween(bought.checkIn, bought.checkOut),
      currencyCode: purchase.currencyCode,
      rateToPkr: purchase.rateToPkr,
      meal: purchase.meal,
      lines: purchase.lines.map(({ roomTypeId, rooms, personsPerRoom, cost }) => ({
        roomTypeId,
        rooms,
        personsPerRoom,
        cost,
      })),
    };
  });
  // Locked contracts still count; they only cannot be changed.
  const confirmed = contracts.filter(
    (contract) => contract.status === 'confirmed' || contract.status === 'locked',
  );
  return {
    purchases: purchaseRecords,
    contracts,
    sales: confirmed.flatMap(salesOf),
    adjustments,
    rates,
    currencies,
    names: {
      hotels: Object.fromEntries(hotels.map((hotel) => [hotel.id, hotel.name])),
      cities: Object.fromEntries(hotels.map((hotel) => [hotel.id, hotel.city])),
      vendors: Object.fromEntries(vendors.map((vendor) => [vendor.id, vendor.name])),
      agents: Object.fromEntries(agents.map((agent) => [agent.id, agent.name])),
      roomTypes: Object.fromEntries(roomTypes.map((type) => [type.id, type.name])),
    } as Record<'hotels' | 'cities' | 'vendors' | 'agents' | 'roomTypes', Record<string, string>>,
  };
}

type Loaded = Awaited<ReturnType<typeof load>>;

function convertFor(
  data: Loaded,
  params: Pick<ReportParams, 'currency' | 'policy' | 'on'>,
): {
  convert: Convert;
  decimals: number;
} {
  try {
    return {
      convert: converter(params.policy, params.currency, params.on, data.rates),
      decimals:
        data.currencies.find((currency) => currency.code === params.currency)?.decimals ?? DEFAULT_DECIMALS,
    };
  } catch (error) {
    if (error instanceof MissingRateError) {
      throw new ApiError({
        kind: 'validation',
        message: `${error.currencyCode} has no rate on ${error.date}.`,
      });
    }
    throw error;
  }
}

const range = (params: ReportParams) => ({ from: params.from, to: params.to });

/** Every report the server would serve. Each loads fresh records and works its figures out. */
export const reportsApi = {
  profitAndLoss: async (params: ReportParams) => {
    await assertCan('report.view', 'finance.view_cost');
    const data = await load();
    const { convert, decimals } = convertFor(data, params);
    const result = profitAndLoss(
      nightFacts(data.purchases, data.sales, convert),
      data.adjustments,
      range(params),
      params.hotelId,
      convert,
      decimals,
    );
    let exchangeDifference: string | null = null;
    if (params.policy === 'revaluation') {
      const atTransaction = convertFor(data, { ...params, policy: 'transaction' });
      const baseline = profitAndLoss(
        nightFacts(data.purchases, data.sales, atTransaction.convert),
        [],
        range(params),
        params.hotelId,
        atTransaction.convert,
        decimals,
      );
      exchangeDifference = roundTo(dec(baseline.total.profitKnown).minus(result.total.profitKnown), decimals);
    }
    return { ...result, exchangeDifference, names: data.names };
  },

  contractProfit: async (params: ReportParams) => {
    await assertCan('report.view', 'finance.view_cost');
    const data = await load();
    const { convert, decimals } = convertFor(data, params);
    const rows = contractProfit(nightFacts(data.purchases, data.sales, convert), range(params), decimals);
    return { rows: rows.sort((a, b) => a.number.localeCompare(b.number)), names: data.names };
  },

  vendorMargin: async (params: ReportParams) => {
    await assertCan('report.view', 'finance.view_cost');
    const data = await load();
    const { convert, decimals } = convertFor(data, params);
    const rows = vendorMargin(
      nightFacts(data.purchases, data.sales, convert),
      data.purchases,
      range(params),
      convert,
      decimals,
    );
    return { rows, names: data.names };
  },

  inventory: async (params: ReportParams) => {
    await assertCan('report.view', 'finance.view_cost');
    const data = await load();
    const { convert, decimals } = convertFor(data, params);
    const rows = inventoryRows(
      nightFacts(data.purchases, data.sales, convert).pools,
      range(params),
      params.hotelId,
      decimals,
    );
    return { rows, names: data.names };
  },

  sales: async (params: SalesParams) => {
    await assertCan('report.view');
    const data = await load();
    const { convert, decimals } = convertFor(data, params);
    const contracts = data.contracts.filter(
      (contract) =>
        contract.status === params.status &&
        dateInRange(contract.date, range(params)) &&
        (params.mealPlan === '' || contract.mealPlan.kind === params.mealPlan),
    );
    const sales = contracts.flatMap((contract) =>
      salesOf(contract).filter((sale) => {
        const entry = contract.hotels[Number(sale.id.split(':')[1])];
        return (
          (params.hotelId === '' || sale.hotelId === params.hotelId) &&
          (params.city === '' || data.names.cities[sale.hotelId] === params.city) &&
          (params.rateType === '' || entry?.rateType === params.rateType)
        );
      }),
    );
    return {
      rows: salesRows(sales, data.purchases, params.groupBy, convert, decimals),
      names: data.names,
      cities: [...new Set(Object.values(data.names.cities))].sort(),
    };
  },
};
