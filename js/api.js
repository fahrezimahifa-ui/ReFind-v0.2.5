// Server session and database are the authority. This state exists only in memory.
window.ReFind = (() => {
  const base = document.querySelector('meta[name="app-base"]').content;
  const state = {csrf: '', user: null};
  async function request(endpoint, values) {
    const options = {credentials: 'same-origin', cache: 'no-store'};
    if (values) {
      const form = values instanceof FormData ? values : new FormData();
      if (!(values instanceof FormData)) Object.entries(values).forEach(([key, value]) => form.append(key, value));
      options.method = 'POST'; options.body = form; options.headers = {'X-CSRF-Token': state.csrf};
    }
    let response;
    try { response = await fetch(base + 'api/' + endpoint, options); }
    catch { throw Object.assign(new Error('Could not reach ReFind. Check your connection and try again.'), {status: 0}); }
    let result;
    try { result = await response.json(); }
    catch { throw Object.assign(new Error('The server did not return a valid response.'), {status: response.status}); }
    // A generic server failure reads as an outage, not as a problem with what the person typed.
    const message = response.status === 500 ? 'ReFind is temporarily unavailable. Please try again in a moment.' : result.message || 'Request failed.';
    if (!response.ok || !result.ok) throw Object.assign(new Error(message), {status: response.status, code: result.code, fields: result.fields || {}, retryAfter: Number(response.headers.get('Retry-After') || 0)});
    return result;
  }
  async function session() {
    const result = await request('session.php');
    state.csrf = result.csrf; state.user = result.user;
    return result;
  }
  function loginUrl() { return base + 'login.html?return=' + encodeURIComponent(window.location.pathname + window.location.search); }
  return {base, state, request, session, loginUrl};
})();
