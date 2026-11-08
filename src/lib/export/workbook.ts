/** Saving rows as an Excel file. The library loads only when a file is actually saved. */

export type WorkbookCell = string | number;

export interface WorkbookSheet {
  sheet: string;
  rows: WorkbookCell[][];
}

const COLUMN_WIDTH = 22;

/** Sheet names in Excel are at most 31 characters and cannot contain some symbols. */
const sheetName = (name: string) => name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

export async function saveWorkbook(sheets: readonly WorkbookSheet[], fileName: string) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  await writeExcelFile(
    sheets.map(({ sheet, rows }) => ({
      sheet: sheetName(sheet),
      data: rows.map((row, rowIndex) =>
        row.map((value) => (rowIndex === 0 ? { value, fontWeight: 'bold' as const } : { value })),
      ),
      columns: (rows[0] ?? []).map(() => ({ width: COLUMN_WIDTH })),
    })),
  ).toFile(fileName);
}
