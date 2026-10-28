(function () {
  'use strict';
  const key = 'refind-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try { preference = localStorage.getItem(key); } catch (_) { /* Storage may be unavailable. */ }
  if (preference !== 'light' && preference !== 'dark') preference = null;
  function effective() { return preference || (system.matches ? 'dark' : 'light'); }
  function render() {
    const theme = effective();
    root.dataset.theme = theme;
    root.dataset.bsTheme = theme;
    root.style.colorScheme = theme;
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-label', 'Dark mode');
      toggle.setAttribute('aria-pressed', String(theme === 'dark'));
      toggle.title = 'Use ' + (theme === 'dark' ? 'light' : 'dark') + ' mode';
    }
    const select = document.getElementById('theme-preference');
    if (select) select.value = preference || 'system';
    const description = document.getElementById('appearance-current');
    if (description) description.textContent = (preference ? 'Using ' : 'Following your device: ') + theme + ' mode.';
  }
  function setPreference(value) {
    preference = value === 'light' || value === 'dark' ? value : null;
    try { if (preference) localStorage.setItem(key, preference); else localStorage.removeItem(key); } catch (_) { /* Keep the choice for this page. */ }
    render();
    const status = document.getElementById('theme-status');
    if (status) status.textContent = effective() === 'dark' ? 'Dark mode enabled.' : 'Light mode enabled.';
  }
  render(); // Runs before styles and first paint, independently of authentication.
  system.addEventListener('change', function () { if (!preference) render(); });
  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : null;
    render();
  });
  document.addEventListener('DOMContentLoaded', function () {
    render();
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.addEventListener('click', function () { setPreference(effective() === 'dark' ? 'light' : 'dark'); });
    const select = document.getElementById('theme-preference');
    if (select) select.addEventListener('change', function () { setPreference(select.value); });
  });
  window.ReFindTheme = Object.freeze({getPreference: function () { return preference || 'system'; }, effective: effective, setPreference: setPreference});
})();
