// Daily ping (see "crons" in vercel.json). Free Supabase projects pause after
// a week without requests, and the menu and shop are read from Supabase.
module.exports = async (req, res) => {
  try {
    const r = await fetch("https://sbtseghoaxglhaaanirs.supabase.co/rest/v1/categories?select=id&limit=1", {
      headers: { apikey: "sb_publishable_tBmhij1x0ZXi1yUEfkahlA_ZnDrLPFT" },
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok });
  } catch (e) {
    res.status(502).json({ ok: false });
  }
};
