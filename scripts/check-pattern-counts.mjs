import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        pattern_tag, 
        COUNT(*)::int AS problem_count,
        COUNT(CASE WHEN difficulty = 'easy' THEN 1 END)::int AS easy_count,
        COUNT(CASE WHEN difficulty = 'medium' THEN 1 END)::int AS medium_count,
        COUNT(CASE WHEN difficulty = 'hard' THEN 1 END)::int AS hard_count
      FROM public.pattern_bank
      GROUP BY pattern_tag
      ORDER BY pattern_tag ASC;
    `);

    console.log(JSON.stringify(res.rows, null, 2));

    const totalRes = await client.query(`
      SELECT 
        COUNT(*)::int AS total_problems,
        COUNT(DISTINCT pattern_tag)::int AS total_patterns
      FROM public.pattern_bank;
    `);
    console.log("TOTALS:", totalRes.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
