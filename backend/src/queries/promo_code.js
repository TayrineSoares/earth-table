const supabase = require('../../supabase/db')

const normalize = (code) => (code || '').trim();

async function getActivePromoByCode(rawCode) {
  const code = normalize(rawCode);
  if (!code) return null;

  const { data, error } = await supabase
    .from('promo_codes')
    .select('id, code, discount_percentage, active')
    .eq('active', true)
    .ilike('code', code)    // case-insensitive match
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

module.exports = { getActivePromoByCode, normalize };