/*************** Helpers ***************/
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * Wait for a selector or a predicate that returns a node.
 * Usage:
 *   await waitFor('#myId');
 *   await waitFor(() => document.querySelector('.ready'));
 */
async function waitFor(selectorOrPredicate, { timeout = 20000, poll = 100 } = {}) {
  const start = performance.now();
  while (performance.now() - start < timeout) {
    try {
      if (typeof selectorOrPredicate === 'string') {
        const el = document.querySelector(selectorOrPredicate);
        if (el) return el;
      } else if (typeof selectorOrPredicate === 'function') {
        const result = selectorOrPredicate();
        if (result) return result;
      }
    } catch (e) { /* ignore transient errors */ }
    await sleep(poll);
  }
  throw new Error(`waitFor timeout: ${selectorOrPredicate.toString()}`);
}

/** Set input value in a way frameworks notice, then fire events */
function setInputValue(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(el.__proto__, 'value')?.set
    || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Click via DOM event (closer to real user interaction) */
function realClick(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

/** Safe check: is element visible & not disabled */
function isVisibleAndEnabled(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  const enabled = !el.disabled && !el.classList.contains('disabled');
  return visible && enabled;
}

/*************** Core Steps ***************/
async function makeSelection(security_code, from_date, to_date, delay = 500) {
  // Disable dialogs to avoid blocking
  window.alert = () => {};
  window.confirm = () => true;
  window.prompt = () => null;

  // 1) Select announcement type (Equity T+1?)
  const annType = await waitFor('#ddlAnnType');
  annType.value = 'C';
  annType.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(delay);

  // 2) Enter security code and accept suggestion
  const search = await waitFor('#scripsearchtxtbx');
  search.focus();
  setInputValue(search, security_code);
  search.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  await sleep(Math.max(250, delay)); // give suggestions time to render

  // Try to click the suggestion if present (adjust selectors if site differs)
  const suggestion = await waitFor(() =>
    document.querySelector('#ulSearchResult li, .ui-autocomplete li, .typeahead li'), { timeout: 5000 }
  ).catch(() => null);

  if (suggestion) {
    realClick(suggestion);
    await sleep(300);
  } else {
    // fallback: press Enter to accept top suggestion
    ['keydown', 'keypress', 'keyup'].forEach(type =>
      search.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
    );
    await sleep(300);
  }

  // 3) Select date range radio
  const rdbDaily = await waitFor('#rdbDaily');
  if (!rdbDaily.checked) realClick(rdbDaily);
  await sleep(200);

  // 4) Set from/to dates
  const from = await waitFor('#txtFromDate');
  from.removeAttribute('onkeypress');
  from.removeAttribute('onpaste');
  setInputValue(from, from_date);
  await sleep(150);

  const to = await waitFor('#txtToDate');
  to.removeAttribute('onkeypress');
  to.removeAttribute('onpaste');
  setInputValue(to, to_date);
  await sleep(150);

  // 5) Submit
  const submitBtn = await waitFor('#btnSubmit');
  realClick(submitBtn);

  // 6) Wait for download link to be ready and click
  const dlLink = await waitFor(() => {
    const a = document.querySelector('#lnkDownload');
    return isVisibleAndEnabled(a) ? a : null;
  }, { timeout: 30000 });
  realClick(dlLink);

  // 7) Small wait to ensure download triggers
  await sleep(1000);

  // 8) Clear the search box for the next run
  setInputValue(search, '');
  search.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', keyCode: 8, which: 8, bubbles: true }));
  await sleep(200);
}

/*************** Batch Orchestration ***************/
function formatDateDDMMYYYY(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Run securities sequentially (IMPORTANT: not forEach).
 * yearIndex = 0 => now..now-365d; 1 => one year back window, etc.
 */
async function executeDownload(lists, yearIndex = 0, perStepDelay = 500) {
  // Compute dates robustly
  const currentDate = new Date("2025-12-01");
  // 1st dec. 2025
  // currentDate.setFullYear(currentDate.getFullYear() - yearIndex);
  currentDate.setDate(currentDate.getDate() - 365 * yearIndex);

  const pastDate = new Date(currentDate);
  pastDate.setDate(pastDate.getDate() - 365);

  const currentDateStr = formatDateDDMMYYYY(currentDate);
  const pastDateStr = formatDateDDMMYYYY(pastDate);

  console.log('Current Date:', currentDateStr);
  console.log('Date 365 Days Ago:', pastDateStr);

  const codes = lists.split(',').map(s => s.trim()).filter(Boolean);

  for (const code of codes) {
    console.log('Processing:', code);
    try {
      await makeSelection(code, pastDateStr, currentDateStr, perStepDelay);
    } catch (err) {
      console.error('Failed for', code, err);
    }
    // Small gap between iterations
    await sleep(500);
  }
}