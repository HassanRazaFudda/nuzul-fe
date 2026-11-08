import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { agreementDocument, AgreementPages, agreementSettingsQuery } from '@/features/agreement';
import { calendarMonthsQuery } from '@/features/calendar';
import { roomTypesQuery } from '@/features/room-types';

import { contractDetailQuery } from '../api/contract.queries';

/** The contract as the owner's Hotel Accommodation Agreement, to print or save as PDF. */
export function ContractPrintPage() {
  const { id = '' } = useParams();
  const { data: contract } = useSuspenseQuery(contractDetailQuery(id));
  const [{ data: months }, { data: roomTypes }, { data: settings }] = useSuspenseQueries({
    queries: [calendarMonthsQuery, roomTypesQuery, agreementSettingsQuery],
  });

  const shortName = (roomTypeId: string) => {
    const custom = settings.roomTypeShortNames[roomTypeId]?.trim();
    return custom && custom.length > 0
      ? custom
      : (roomTypes.find((type) => type.id === roomTypeId)?.name ?? roomTypeId).toUpperCase();
  };
  const document = agreementDocument(contract, { months, seasonWord: settings.seasonWord, shortName });

  return (
    <div className="bg-background p-5 lg:p-8 print:bg-transparent print:p-0">
      <title>{`${contract.number} · Agreement · Nuzul`}</title>
      <div className="mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
        {contract.status !== 'confirmed' && contract.status !== 'locked' ? (
          <p className="text-danger-strong text-sm font-semibold">This contract is {contract.status}.</p>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Link to={`/contracts/${id}`} className={buttonClass('secondary')}>
            Back to contract
          </Link>
          <Button
            icon={<Printer aria-hidden className="size-4" />}
            onClick={() => {
              window.print();
            }}
          >
            Print or save as PDF
          </Button>
        </div>
      </div>
      <AgreementPages document={document} settings={settings} secondParty={contract.agentCompany} />
    </div>
  );
}
