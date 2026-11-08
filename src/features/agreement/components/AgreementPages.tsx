import type { ReactNode } from 'react';

import type { AgreementSettings } from '../api/agreement.schemas';
import type { AgreementDocument } from '../domain/agreement';

/*
 * Measurements follow the owner's agreement (FORMET.pdf), scaled to A4: the letterhead and
 * footer run 18 mm from the paper's edges, the text 32 mm, in Times at 11 pt; as there, the
 * payment terms and the terms and conditions are set a little smaller.
 */

/** Text between ** pairs prints in bold. */
function Rich({ text }: { text: string }) {
  return text
    .split('**')
    .map((part, index) =>
      index % 2 === 1 ? <strong key={`${String(index)}-${part}`}>{part}</strong> : part,
    );
}

/** The company name, condensed to the letterhead's width as in the owner's format. */
function CompanyName({ name }: { name: string }) {
  // 3.3 mm a character keeps a shorter name in the same proportions instead of stretching it.
  const width = Math.min(124, name.length * 3.3);
  return (
    <svg
      viewBox={`0 0 ${String(width)} 9.6`}
      style={{ width: `${String(width)}mm`, height: '9.6mm' }}
      role="img"
      aria-label={name}
      className="block overflow-visible"
    >
      <text
        x="0"
        y="8.4"
        textLength={width}
        lengthAdjust="spacingAndGlyphs"
        fontFamily="Impact, Haettenschweiler, 'Arial Narrow Bold', 'Arial Narrow', sans-serif"
        fontSize="10.4"
        fill="#e31e24"
      >
        {name.split(/(&)/).map((part, index) =>
          part === '&' ? (
            <tspan key={`amp-${String(index)}`} fontSize="7.4">
              &amp;
            </tspan>
          ) : (
            part
          ),
        )}
      </text>
    </svg>
  );
}

function Sheet({ settings, children }: { settings: AgreementSettings; children: ReactNode }) {
  return (
    <section className="relative mx-auto flex min-h-[297mm] w-[210mm] max-w-full flex-col overflow-hidden bg-[#fff] text-[#000] shadow-sm not-first:break-before-page print:min-h-[296.5mm] print:max-w-none print:shadow-none">
      <img
        src="/brand/logo.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-[calc(50%+5mm)] w-[114mm] -translate-x-1/2 -translate-y-1/2 opacity-[0.28]"
      />
      <header className="relative mx-[18mm] mt-[10.5mm] flex h-[23mm] items-start border-b border-[#e31e24]">
        <img
          src="/brand/logo.png"
          alt="Junaidi Air Travels"
          className="ms-[5mm] h-[21mm] w-[21mm] shrink-0 object-contain"
        />
        <div className="flex flex-1 flex-col items-center pt-[2.6mm]">
          <CompanyName name={settings.companyName} />
          <p className="mt-[2.4mm] border-y-[0.45mm] border-[#000] px-[0.5mm] font-[Arial,Helvetica,sans-serif] text-[15pt] leading-[1.15] font-bold">
            G.L. No. {settings.glNumber}
          </p>
        </div>
        <div className="flex w-[15mm] shrink-0 flex-col items-center gap-[1.5mm] pt-[1.5mm]">
          <img src="/brand/iata.svg" alt="IATA" className="h-[9.5mm] w-[15mm] object-contain" />
          <img
            src="/brand/taap.png"
            alt="Travel Agents Association of Pakistan"
            className="h-[10mm] w-[14.5mm] object-contain"
          />
        </div>
      </header>
      <div className="relative flex-1 ps-[32mm] pe-[29.5mm] pt-[6mm] font-['Times_New_Roman',Times,'Liberation_Serif',Tinos,serif] text-[11pt] leading-[1.17]">
        {children}
      </div>
      <footer className="relative mx-[18mm] mb-[13mm] border-t border-[#000] pt-[2.6mm] text-center font-[Calibri,Carlito,'Segoe_UI',sans-serif] text-[9pt] leading-[1.25]">
        <p>{settings.address}</p>
        <p>
          Tel: {settings.phone} E-mail: {settings.email}
        </p>
      </footer>
    </section>
  );
}

/** "29th" with its suffix raised, as in the owner's format. */
function Ordinal({ value }: { value: string }) {
  const [, digits = value, suffix = ''] = /^(\d+)(\D*)$/.exec(value) ?? [];
  return (
    <>
      {digits}
      <sup className="text-[0.65em]">{suffix}</sup>
    </>
  );
}

function Bullets({ items, className = '' }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={`ms-[6.2mm] ${className}`}>
      {items.map((item, index) => (
        <li
          // Bullets can repeat word for word, so the position is part of the key.
          key={index}
          className="relative ps-[5.1mm] before:absolute before:left-0 before:content-['•']"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

interface AgreementPagesProps {
  document: AgreementDocument;
  settings: AgreementSettings;
  secondParty: string;
}

/** The Hotel Accommodation Agreement, laid out as the owner's format (FORMET.pdf). */
export function AgreementPages({ document, settings, secondParty }: AgreementPagesProps) {
  /** Every cell sets its own padding, so no two utilities compete. */
  const cell = (padding = 'px-[2mm] py-[2mm]') => `border border-[#000] align-middle ${padding}`;
  const [firstSection, ...otherSections] = settings.termsSections;
  const lastRow = document.rows.length - 1;

  return (
    <div className="space-y-6 print:space-y-0 print:[print-color-adjust:exact]">
      <Sheet settings={settings}>
        <h1 className="text-center text-[16pt] font-bold underline underline-offset-[0.6mm]">
          HOTEL ACCOMMODATION AGREEMENT
        </h1>
        <p className="mt-[6.5mm] font-bold">{document.season}</p>
        <p className="mt-[4.2mm]">
          This Agreement is entered into on this <Ordinal value={document.dayOrdinal} />{' '}
          <strong>day of {document.monthYear}</strong>, by and between:
        </p>
        <ol className="mt-[4.2mm]">
          <li className="relative ps-[5.6mm]">
            <span className="absolute left-0">1.</span>
            <strong>FIRST PARTY: {settings.companyName}</strong> (G.L. No. {settings.glNumber}), represented
            by its {settings.ceoTitle}, <strong>Mr. {settings.ceoName}</strong> (hereinafter referred to as
            the <em>&quot;First Party&quot;</em>);
          </li>
          <li className="mt-[4.2mm] text-center font-bold">AND</li>
          <li className="relative mt-[4.2mm] ps-[5.6mm]">
            <span className="absolute left-0 font-bold">2.</span>
            <strong>SECOND PARTY: {secondParty.toUpperCase()}</strong> (hereinafter referred to as the{' '}
            <em>&quot;Second Party&quot;</em>);
          </li>
        </ol>
        <p className="mt-[8.5mm]">{settings.recital}</p>

        <h2 className="mt-[4.4mm] ps-[11.7mm] text-[12.5pt] leading-none font-bold">
          1. ACCOMMODATION DETAILS &amp; PRICING SCHEDULING
        </h2>
        <table className="mt-[0.6mm] w-full table-fixed border-separate border-spacing-[0.6mm] border border-[#000]">
          <caption className="sr-only">Accommodation details and pricing</caption>
          <colgroup>
            <col className="w-[25.5%]" />
            <col className="w-[19.3%]" />
            <col className="w-[17.6%]" />
            <col className="w-[20.4%]" />
            <col className="w-[17.2%]" />
          </colgroup>
          <thead>
            <tr className="text-start font-bold">
              <th scope="col" className={`${cell('px-[2mm] py-[3mm]')} text-start`}>
                Hotel Name
              </th>
              <th scope="col" className={`${cell('px-[2mm] py-[3mm]')} text-start`}>
                Period / Stay Duration
              </th>
              <th scope="col" className={`${cell('px-[2mm] py-[3mm]')} text-start`}>
                Room Quantity &amp; Type
              </th>
              <th scope="col" className={`${cell('px-[2mm] py-[3mm]')} text-start`}>
                Rate Structure (Per Room)
              </th>
              <th scope="col" className={`${cell('px-[2mm] py-[3mm]')} text-start`}>
                Total Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {document.rows.map((row, index) => {
              // As in the owner's format, the last hotel's rooms, rate and total run down
              // beside the grand total.
              const span = index === lastRow ? 2 : 1;
              return (
                <tr key={`${row.hotel}-${String(index)}`} className="break-inside-avoid">
                  <td className={`${cell('px-[1.5mm] py-[3mm]')} text-center font-bold`}>{row.hotel}</td>
                  <td className={`${cell('px-[0.8mm] py-[2mm]')} text-center text-[10pt]`}>
                    <span className="block whitespace-nowrap">{row.from}</span>
                    TO
                    <span className="block whitespace-nowrap">{row.to}</span>
                  </td>
                  <td rowSpan={span} className={`${cell()} text-center`}>
                    {row.rooms.map((room) => (
                      <span key={room} className="block">
                        {room}
                      </span>
                    ))}
                    ROOMS
                  </td>
                  <td rowSpan={span} className={cell()}>
                    {row.rateLabel && <span className="mb-[3.6mm] block">{row.rateLabel}</span>}
                    {row.rates.map((rate) => (
                      <span key={rate} className="block">
                        {rate}
                      </span>
                    ))}
                    <span className="block text-[10pt]">{row.rateBasis}</span>
                  </td>
                  <td rowSpan={span} className={`${cell()} font-bold whitespace-nowrap`}>
                    {row.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className={cell('px-[2mm] py-[1.6mm]')}>GRAND TOTAL</td>
              <td className={`${cell('px-[2mm] py-[1.6mm]')} whitespace-nowrap`}>{document.grandTotal}</td>
            </tr>
          </tfoot>
        </table>

        <Bullets
          className="mt-[6.2mm]"
          items={[
            <>
              <strong>Meal Plan:</strong> {document.mealPlan}
            </>,
          ]}
        />

        <h2 className="mt-[6.4mm] text-[12.5pt] font-bold">2. TERMS OF PAYMENT</h2>
        <Bullets
          className="mt-[4.6mm] text-[10.6pt]"
          items={settings.paymentTerms.map((term) => (
            <>
              <strong>{term.lead}:</strong> <Rich text={term.text} />
            </>
          ))}
        />
      </Sheet>

      <Sheet settings={settings}>
        <h2 className="mt-[12mm] text-[12.5pt] font-bold">
          3. TERMS &amp; CONDITIONS:
          {firstSection && <span className="text-[11pt]">{firstSection.heading}:</span>}
        </h2>
        {firstSection && (
          <Bullets
            className="mt-[3.4mm] text-[10.2pt]"
            items={firstSection.bullets.map((bullet) => (
              <Rich key={bullet} text={bullet} />
            ))}
          />
        )}
        <ol>
          {otherSections.map((section, index) => (
            <li key={`${section.heading}-${String(index)}`} className="relative mt-[5.6mm]">
              <span className="absolute -left-[6mm]">{index + 1}.</span>
              <p className="font-bold">{section.heading}:</p>
              <Bullets
                className="text-[10.2pt]"
                items={section.bullets.map((bullet) => (
                  <Rich key={bullet} text={bullet} />
                ))}
              />
            </li>
          ))}
        </ol>
        <p className="mt-[6.4mm] text-[11.7pt] leading-[1.2] font-bold">{settings.witness}</p>
        <div className="mt-[14.5mm] grid grid-cols-[55.6%_1fr] leading-[1.12] font-bold">
          <div>
            <p>For &amp; On Behalf of First Party</p>
            <p>{settings.signatory}</p>
            <p>{settings.ceoName}</p>
            <p className="font-normal italic">({settings.ceoTitle})</p>
          </div>
          <div>
            <p>For &amp; On Behalf of Second Party</p>
            <p>{secondParty.toUpperCase()}</p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
