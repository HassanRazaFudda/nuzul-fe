/** Every report, in the order people reach for them. One list for the index and the switcher. */
export const REPORTS = [
  {
    to: '/profit-loss',
    title: 'Profit & loss',
    short: 'Profit & loss',
    text: 'Rooms used in a period, at the weighted average cost, with room and meal margins',
  },
  { to: '/reports/sales', title: 'Sales', short: 'Sales', text: 'By date, agent, hotel or vendor' },
  {
    to: '/reports/contracts',
    title: 'Contract profitability',
    short: 'Contracts',
    text: 'Profit on each contract signed in a period',
  },
  {
    to: '/reports/vendors',
    title: 'Vendor-wise margin',
    short: 'Vendors',
    text: 'Each vendor at their actual rates',
  },
  {
    to: '/reports/inventory',
    title: 'Sold and unsold inventory',
    short: 'Inventory',
    text: 'Room-nights per hotel, room type and night',
  },
  {
    to: '/reports/exposure',
    title: 'Unsold cost exposure',
    short: 'Unsold cost',
    text: 'What the purchased nights not yet sold cost',
  },
] as const;
