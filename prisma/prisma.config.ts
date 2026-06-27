module.exports = {
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres.qljwvbfbjubkvqtqsbpd:ccHaoGW3wvPtNSJJ@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
    directUrl: process.env.DIRECT_URL || 'postgresql://postgres.qljwvbfbjubkvqtqsbpd:ccHaoGW3wvPtNSJJ@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
  },
};