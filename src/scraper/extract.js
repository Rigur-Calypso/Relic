import * as cheerio from 'cheerio';

/**
 * Layer 1: extract equipment via a hardcoded selector. INTENTIONALLY BRITTLE.
 * When the target's DOM changes, this returns [] and the scrape is marked unhealthy.
 */
export function extractBySelector(html) {
  const $ = cheerio.load(html);
  const rows = $('#equipment-table tbody tr');   // brittle by design
  const equipment = [];
  rows.each((_, el) => {
    const cells = $(el).find('td').map((__, td) => $(td).text().trim()).get();
    if (cells.length >= 4) {
      equipment.push({
        name: cells[0] || '',
        specifications: cells[1] || '',
        location: cells[2] || '',
        status: cells[3] || '',
      });
    }
  });
  return equipment;
}
