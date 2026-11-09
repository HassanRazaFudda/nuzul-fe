import { useSuspenseQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/DataTable';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useCan } from '@/lib/auth/session';
import { dayNumber, isoDate } from '@/lib/format/dates';

import { calendarMonthsQuery, useRemoveCalendarMonth, useSaveCalendarMonth } from '../api/calendar.queries';
import { monthColumns } from '../components/month-columns';
import type { MonthFormValues } from '../components/month-form.schema';
import { MonthForm } from '../components/MonthForm';
import { calendarProblems, sortMonths, type CalendarMonth } from '../domain/calendar';

const USUAL_MONTH_DAYS = 30;

export function CalendarPage() {
  const can = useCan();
  const canManage = can('calendar.manage');
  const { data: months } = useSuspenseQuery(calendarMonthsQuery);
  const saveMonth = useSaveCalendarMonth();
  const removeMonth = useRemoveCalendarMonth();
  const [editing, setEditing] = useState<CalendarMonth | 'new' | null>(null);
  const [removing, setRemoving] = useState<CalendarMonth | null>(null);

  const sorted = sortMonths(months);
  const last = sorted.at(-1);
  const problems = calendarProblems(months);
  // A new month starts where the calendar ends, so the usual case is one field.
  const nextDefaults: Partial<MonthFormValues> = last
    ? {
        cycle: last.cycle,
        ordinal: last.ordinal + 1,
        days: USUAL_MONTH_DAYS,
        startDate: isoDate(dayNumber(last.startDate) + last.days),
      }
    : { days: USUAL_MONTH_DAYS };
  const current = editing === 'new' ? null : editing;

  async function handleSave(values: MonthFormValues) {
    await saveMonth.mutateAsync({ id: current?.id ?? crypto.randomUUID(), ...values });
    setEditing(null);
    toast(`${values.name} ${values.cycle} saved`);
  }

  async function handleRemove() {
    if (!removing) return;
    await removeMonth.mutateAsync(removing.id);
    toast(`${removing.name} ${removing.cycle} removed`);
    setRemoving(null);
  }

  const columns = monthColumns({ onEdit: setEditing, onRemove: setRemoving });

  return (
    <>
      <PageHeader
        title="Calendar"
        action={
          canManage && (
            <Button
              icon={<Plus aria-hidden className="size-4" />}
              onClick={() => {
                setEditing('new');
              }}
            >
              Add month
            </Button>
          )
        }
      />
      <div className="space-y-5 p-5 lg:p-8">
        {problems.length > 0 && (
          <ErrorNotice title="The months do not line up">
            <ul className="space-y-0.5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </ErrorNotice>
        )}
        <Card>
          <DataTable
            caption="Calendar months"
            columns={canManage ? columns : columns.filter((column) => column.id !== 'actions')}
            data={sorted}
            getRowId={(month) => month.id}
            sort={undefined}
            onSortChange={() => undefined}
            emptyState={<EmptyState title="No months yet" hint="Add the months your bookings fall in" />}
          />
        </Card>
        <p className="text-muted text-xs">Sample months. Enter the dates announced for each month</p>
      </div>
      {editing && (
        <MonthForm
          month={current}
          defaults={nextDefaults}
          taken={months
            .filter((month) => month.id !== current?.id)
            .map((month) => `${month.cycle}/${String(month.ordinal)}`)}
          onSave={handleSave}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onCancel={() => {
          setRemoving(null);
        }}
        onConfirm={() => void handleRemove()}
        title={`Remove ${removing?.name ?? ''} ${removing?.cycle ?? ''}?`}
        confirmLabel="Remove month"
        tone="danger"
      >
        Dates in this month will show as English dates until it is added again. Bookings stay on the same
        nights.
      </ConfirmDialog>
    </>
  );
}
