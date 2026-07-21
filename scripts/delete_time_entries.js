/*
  One-off deletion script for time-tracking entries.

  Usage:
    node scripts/delete_time_entries.js \
      --companyId=68483797e8a6d1eb42fba9d0 \
      --userId=68da0a0eb1e54a0fa73612c5 \
      --from=2025-10-01 \
      --to=2025-11-01 \
      [--dry-run] \
      --confirm

  Notes:
    - --dry-run shows the count only, without deleting.
    - --confirm is required to perform deletion.
*/

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const TimeTrackingModel = require('../models/timeTrackingModel/TimeTrackingModel');

function parseArgs(argv) {
  const args = {};
  argv.slice(2).forEach((part) => {
    if (part.startsWith('--')) {
      const [k, v] = part.replace(/^--/, '').split('=');
      args[k] = v === undefined ? true : v;
    }
  });
  return args;
}

function createDateParsingExpression(dateStr) {
  return {
    $dateFromString: {
      dateString: dateStr,
      format: {
        $switch: {
          branches: [
            // D-M-YYYY
            { case: { $regexMatch: { input: dateStr, regex: /^\d{1,2}-\d{1,2}-\d{4}$/ } }, then: '%d-%m-%Y' },
            // DD MMM YYYY
            { case: { $regexMatch: { input: dateStr, regex: /^\d{2} \w{3} \d{4}$/ } }, then: '%d %b %Y' },
            // M/D/YYYY
            { case: { $regexMatch: { input: dateStr, regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/ } }, then: '%m/%d/%Y' },
            // ISO YYYY-MM-DD
            { case: { $regexMatch: { input: dateStr, regex: /^\d{4}-\d{2}-\d{2}$/ } }, then: '%Y-%m-%d' },
          ],
          default: '%d %b %Y',
        },
      },
      onError: null,
    },
  };
}

async function run() {
  const args = parseArgs(process.argv);
  const companyId = args.companyId;
  const userId = args.userId;
  const from = args.from; // expected YYYY-MM-DD
  const to = args.to;     // expected YYYY-MM-DD
  const dryRun = Boolean(args['dry-run']);
  const confirm = Boolean(args.confirm);

  if (!companyId || !userId || !from || !to) {
    console.error('Missing required args. Example: --companyId=... --userId=... --from=2025-10-01 --to=2025-11-01');
    process.exit(1);
  }

  await connectDB();

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const toDateInclusive = new Date(toDate);
    toDateInclusive.setDate(toDateInclusive.getDate() + 1);

    const filters = {
      companyId,
      userId,
      $expr: {
        $and: [
          { $gte: [createDateParsingExpression('$dateString'), fromDate] },
          { $lt: [createDateParsingExpression('$dateString'), toDateInclusive] },
        ],
      },
    };

    const total = await TimeTrackingModel.countDocuments(filters);
    console.log(`Matched time entries: ${total} (companyId=${companyId}, userId=${userId}, from=${from}, to=${to})`);

    if (total === 0) {
      return;
    }

    if (dryRun || !confirm) {
      console.log('Dry run or missing --confirm. No deletions performed.');
      return;
    }

    const result = await TimeTrackingModel.deleteMany(filters);
    console.log(`Deleted: ${result.deletedCount} time entries.`);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();


