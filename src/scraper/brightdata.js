import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BDATA = process.env.BDATA_BIN || 'bdata';

/**
 * Fetch a URL through Bright Data. Returns raw stdout in the requested format.
 * format: 'markdown' | 'html' | 'json'
 */
export async function fetchViaBrightData(url, { format = 'markdown', country } = {}) {
  const args = ['scrape', url, '-f', format];
  if (country) args.push('--country', country);
  const { stdout } = await execFileAsync(BDATA, args, {
    maxBuffer: 1024 * 1024 * 25,       // 25 MB, big pages are fine
    timeout: 120000,                   // 2 min hard cap
  });
  return stdout;
}
