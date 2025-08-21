declare module "csv-parser" {
  import { Transform } from "stream";
  interface Options {
    separator?: string;
    headers?: boolean | string[];
    skipLines?: number;
    strict?: boolean;
  }
  function csv(options?: Options): Transform;
  export default csv;
}
