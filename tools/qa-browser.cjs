// Shared opt-in theme coverage; defaults preserve historical suite behavior.
async function themedContext(browser, options = {}) {
  const theme = process.env.REFIND_THEME;
  if (theme && theme !== 'light' && theme !== 'dark') throw new Error('REFIND_THEME must be light or dark');
  const context = await browser.newContext({...options, ...(theme ? {colorScheme: theme} : {})});
  if (theme) await context.addInitScript(value => localStorage.setItem('refind-theme', value), theme);
  return context;
}
module.exports = {themedContext};
