const XLSX = require("xlsx");

const MAX_EXPORT_ROWS = 50000;

const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

const toCsv = (columns, rows) => {
  const header = columns.map((c) => escapeCsv(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsv(typeof c.format === "function" ? c.format(row) : row[c.key])).join(",")
  );
  return [header, ...lines].join("\r\n");
};

const normalizeFormat = (format) => {
  const f = (format || "csv").toString().toLowerCase();
  if (f === "xlsx" || f === "excel") return "xlsx";
  return "csv";
};

const sendExportResponse = (res, { columns, rows, filename, format }) => {
  if (rows.length > MAX_EXPORT_ROWS) {
    return res.status(400).send({
      success: false,
      message: `Export exceeds maximum of ${MAX_EXPORT_ROWS} rows. Please narrow your filters.`,
    });
  }

  const normalized = normalizeFormat(format);
  const baseName = filename || "export";

  if (normalized === "xlsx") {
    const sheetRows = rows.map((row) => {
      const obj = {};
      columns.forEach((col) => {
        obj[col.label] = typeof col.format === "function" ? col.format(row) : row[col.key];
      });
      return obj;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.xlsx"`);
    return res.status(200).send(buffer);
  }

  const csv = toCsv(columns, rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${baseName}.csv"`);
  return res.status(200).send(csv);
};

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

module.exports = {
  MAX_EXPORT_ROWS,
  toCsv,
  sendExportResponse,
  normalizeFormat,
  formatDate,
};
