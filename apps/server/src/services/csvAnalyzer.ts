import { createReadStream } from "fs";
import csv from "csv-parser";
import { ParsedCSV } from "../types";

export class CSVAnalyzer {
  static async parseCSV(filePath: string): Promise<ParsedCSV> {
    const results: Array<Record<string, string>> = [];
    const headers: string[] = [];

    return new Promise((resolve, reject) => {
      createReadStream(filePath)
        .pipe(csv())
        .on("headers", (headerList: string[]) => {
          headers.push(...headerList);
        })
        .on("data", (data: Record<string, string>) => {
          if (results.length < 1000) {
            results.push(data);
          }
        })
        .on("end", () => {
          resolve({
            headers,
            data: results,
            totalRows: results.length,
            sample: results.slice(0, 5),
          });
        })
        .on("error", reject);
    });
  }

  static analyzeDataTypes(data: Array<Record<string, string>>): Record<string, string> {
    const inferredTypes: Record<string, string> = {};
    const sample = data.slice(0, 100);

    const firstRow = sample[0] || {};
    Object.keys(firstRow).forEach((column) => {
      const values = sample.map((row) => row[column]).filter((val) => val !== "");

      const isNumeric = values.every((val) => !isNaN(parseFloat(val)) && isFinite(Number(val)));
      const isDate = values.every((val) => !isNaN(Date.parse(val)));

      if (isNumeric) inferredTypes[column] = "numeric";
      else if (isDate) inferredTypes[column] = "date";
      else inferredTypes[column] = "categorical";
    });

    return inferredTypes;
  }
}
