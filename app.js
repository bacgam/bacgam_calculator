(function () {
  'use strict';
  const form = document.getElementById('trade-form');
  const element = id => document.getElementById(id);
  const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
  const percentageFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const marginFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const format = value => value > 0 && value < 0.00000001 ? value.toExponential(4) : numberFormat.format(value);
  const percent = value => value > 0 && value < 0.01 ? '<0.01%' : percentageFormat.format(value) + '%';
  const setText = (id, text) => { element(id).textContent = text; };
  const numericInputIds = new Set(['entry', 'stop', 'risk', 'seed', 'risk-percent', 'leverage']);
  const rawInput = id => element(id).value.replace(/,/g, '').trim();
  function readInput(id) {
    const raw = rawInput(id);
    return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) ? Number(raw) : NaN;
  }
  function formatInput(input) {
    const previous = input.value;
    const raw = previous.replace(/,/g, '');
    if (!/^-?\d*(?:\.\d*)?$/.test(raw)) return;
    const decimal = raw.indexOf('.');
    const integer = decimal < 0 ? raw : raw.slice(0, decimal);
    const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decimal < 0 ? '' : raw.slice(decimal));
    if (formatted === previous) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const direction = input.selectionDirection;
    function restorePosition(position) {
      const count = previous.slice(0, position).replace(/,/g, '').length;
      let cursor = 0;
      let digits = 0;
      while (cursor < formatted.length && digits < count) {
        if (formatted[cursor] !== ',') digits++;
        cursor++;
      }
      return cursor;
    }
    input.value = formatted;
    if (document.activeElement === input && start !== null && end !== null) {
      input.setSelectionRange(restorePosition(start), restorePosition(end), direction);
    }
  }
  function setResult(id, amount, prefix = '') {
    const unit = document.createElement('small');
    unit.textContent = 'USDT';
    element(id).replaceChildren(document.createTextNode(prefix + format(amount) + ' '), unit);
  }
  function clearResults() {
    ['position-value', 'quantity-value', 'distance-value', 'top-price', 'bottom-price', 'top-amount', 'bottom-amount', 'top-change', 'bottom-change', 'chart-entry', 'stop-result', 'target-result', 'risk-result', 'reward-result'].forEach(id => setText(id, '—'));
    element('scenario').classList.add('invalid');
    element('scenario').setAttribute('aria-label', '입력값을 확인하면 손익 시나리오가 표시됩니다.');
  }
  function updateMargin(position) {
    const input = element('leverage');
    const raw = rawInput('leverage');
    const leverage = readInput('leverage');
    let error = '';
    let margin = null;
    if (raw && (!/^(?:\d+(?:\.\d?)?|\.\d)$/.test(raw) || !Number.isFinite(leverage) || leverage <= 0)) {
      error = '0보다 큰 배율을 소수점 첫째 자리까지 입력해 주세요.';
    } else if (raw && Number.isFinite(position) && position > 0) {
      margin = position / leverage;
      if (!Number.isFinite(margin) || margin <= 0) {
        margin = null;
        error = '계산 가능한 범위를 벗어났습니다. 배율을 조정해 주세요.';
      }
    }
    input.setAttribute('aria-invalid', String(Boolean(error)));
    setText('leverage-error', error);
    setText('margin-value', margin === null ? '—' : margin < 0.01 ? format(margin) : marginFormat.format(margin));
    element('margin-value').title = margin === null ? '' : format(margin) + ' USDT';
  }
  function update() {
    const side = form.elements.side.value;
    const ratio = Number(form.elements.ratio.value);
    const mode = form.elements.mode.value;
    const seedMode = mode === 'seed';
    element('amount-risk-fields').hidden = seedMode;
    element('seed-risk-fields').hidden = !seedMode;
    element('risk').disabled = seedMode;
    element('seed').disabled = !seedMode;
    element('risk-percent').disabled = !seedMode;
    const result = PositionCalculator.calculatePosition({ entry: readInput('entry'), stop: readInput('stop'), risk: readInput('risk'), side, ratio, mode, seed: readInput('seed'), riskPercent: readInput('risk-percent') });
    updateMargin(result.valid ? result.position : null);
    [['entry', 'entry'], ['stop', 'stop'], ['risk', 'risk'], ['seed', 'seed'], ['risk-percent', 'riskPercent']].forEach(([id, errorKey]) => {
      const message = result.errors?.[errorKey] || '';
      setText(id + '-error', message);
      element(id).setAttribute('aria-invalid', String(Boolean(message)));
    });
    setText('result-badge', `${side.toUpperCase()} · 1:${ratio}`);
    const customSelected = element('custom-ratio').checked;
    element('custom-ratio-button').classList.toggle('is-selected', customSelected);
    element('custom-ratio-button').setAttribute('aria-pressed', String(customSelected));
    const isLong = side === 'long';
    setText('top-title', isLong ? '익절가' : '손절가');
    setText('bottom-title', isLong ? '손절가' : '익절가');
    setText('top-zone-text', isLong ? 'PROFIT' : 'LOSS');
    setText('bottom-zone-text', isLong ? 'LOSS' : 'PROFIT');
    ['top-zone', 'top-level'].forEach(id => { element(id).classList.toggle('profit', isLong); element(id).classList.toggle('loss', !isLong); });
    ['bottom-zone', 'bottom-level'].forEach(id => { element(id).classList.toggle('profit', !isLong); element(id).classList.toggle('loss', isLong); });
    element('top-zone').style.flexGrow = isLong ? ratio : 1;
    element('bottom-zone').style.flexGrow = isLong ? 1 : ratio;
    element('scenario').style.setProperty('--entry-position', ((isLong ? ratio : 1) / (ratio + 1) * 100) + '%');
    element('scenario').style.minHeight = ((ratio + 1) * 52) + 'px';
    element('result-error').hidden = result.valid;
    if (!result.valid) {
      setText('result-error', result.errors.ratio || result.errors.calculation || '입력값을 확인해 주세요. 올바른 가격과 손절액을 입력하면 포지션 크기가 계산됩니다.');
      clearResults();
      return;
    }
    element('scenario').classList.remove('invalid');
    setText('position-value', format(result.position));
    setText('quantity-value', format(result.quantity));
    setText('distance-value', percent(result.distancePercent));
    setText('chart-entry', format(result.entry));
    const profit = { price: result.target, amount: '+' + format(result.reward), change: (isLong ? '+' : '−') + percent(result.targetPercent) };
    const loss = { price: result.stop, amount: '−' + format(result.risk), change: (isLong ? '−' : '+') + percent(result.distancePercent) };
    const top = isLong ? profit : loss;
    const bottom = isLong ? loss : profit;
    for (const [location, data] of [['top', top], ['bottom', bottom]]) {
      setText(location + '-price', format(data.price));
      setText(location + '-amount', data.amount);
      setText(location + '-change', data.change);
    }
    setResult('stop-result', result.stop);
    setResult('target-result', result.target);
    setResult('risk-result', result.risk, '−');
    setResult('reward-result', result.reward, '+');
    element('scenario').setAttribute('aria-label', `${isLong ? '롱' : '숏'} 포지션, 손익비 1:${ratio}. 진입가 ${format(result.entry)}, 손절가 ${format(result.stop)}, 익절가 ${format(result.target)} USDT. 손절액 ${format(result.risk)}, 익절액 ${format(result.reward)} USDT.`);
  }
  form.addEventListener('beforeinput', event => {
    const input = event.target;
    if (!numericInputIds.has(input.id) || input.selectionStart !== input.selectionEnd) return;
    const cursor = input.selectionStart;
    if (event.inputType === 'deleteContentBackward' && input.value[cursor - 1] === ',') {
      event.preventDefault();
      input.setRangeText('', cursor - 2, cursor, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (event.inputType === 'deleteContentForward' && input.value[cursor] === ',') {
      event.preventDefault();
      input.setRangeText('', cursor, cursor + 2, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  form.addEventListener('input', event => {
    if (event.isComposing) return;
    if (numericInputIds.has(event.target.id)) formatInput(event.target);
    update();
  });
  form.addEventListener('compositionend', event => {
    if (numericInputIds.has(event.target.id)) { formatInput(event.target); update(); }
  });
  form.addEventListener('change', update);
  form.addEventListener('submit', event => event.preventDefault());
  const dialog = element('ratio-dialog');
  const wheel = element('ratio-wheel');
  const track = element('wheel-track');
  const rowHeight = 48;
  let draftRatio = 2;
  let wheelDelta = 0;
  let lastWheelTime = 0;
  let dragStart = null;
  for (let step = 1; step <= 20; step++) {
    const row = document.createElement('div');
    row.className = 'wheel-row';
    row.textContent = String(step / 2);
    track.append(row);
  }
  function setDraft(value) {
    draftRatio = Math.min(10, Math.max(0.5, Math.round(value * 2) / 2));
    track.style.transform = `translateY(${rowHeight * (1 - (draftRatio * 2 - 1))}px)`;
    [...track.children].forEach((row, index) => row.classList.toggle('is-current', index === draftRatio * 2 - 1));
    wheel.setAttribute('aria-valuenow', String(draftRatio));
    wheel.setAttribute('aria-valuetext', `1 대 ${draftRatio}`);
    element('ratio-increase').disabled = draftRatio === 10;
    element('ratio-decrease').disabled = draftRatio === 0.5;
  }
  element('custom-ratio-button').addEventListener('click', () => {
    wheelDelta = 0;
    setDraft(element('custom-ratio-description').dataset.configured ? Number(element('custom-ratio').value) : Number(form.elements.ratio.value));
    dialog.showModal();
    wheel.focus();
  });
  wheel.addEventListener('wheel', event => {
    event.preventDefault();
    if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const now = performance.now();
    if (now - lastWheelTime > 200 || Math.sign(wheelDelta) !== Math.sign(event.deltaY)) wheelDelta = 0;
    lastWheelTime = now;
    wheelDelta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 144 : 1);
    const steps = Math.trunc(wheelDelta / 40);
    if (steps) {
      setDraft(draftRatio + Math.sign(steps) * 0.5);
      wheelDelta = 0;
    }
  }, { passive: false });
  wheel.addEventListener('keydown', event => {
    const actions = { ArrowUp: () => setDraft(draftRatio + 0.5), ArrowDown: () => setDraft(draftRatio - 0.5), Home: () => setDraft(0.5), End: () => setDraft(10) };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  });
  wheel.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dragStart = { y: event.clientY, ratio: draftRatio };
    wheel.setPointerCapture(event.pointerId);
    wheel.focus();
  });
  wheel.addEventListener('pointermove', event => {
    if (dragStart) setDraft(dragStart.ratio + Math.round((dragStart.y - event.clientY) / rowHeight) * 0.5);
  });
  function endDrag() { dragStart = null; }
  wheel.addEventListener('pointerup', endDrag);
  wheel.addEventListener('pointercancel', endDrag);
  wheel.addEventListener('lostpointercapture', endDrag);
  element('ratio-increase').addEventListener('click', () => setDraft(draftRatio + 0.5));
  element('ratio-decrease').addEventListener('click', () => setDraft(draftRatio - 0.5));
  ['ratio-dialog-close', 'ratio-cancel'].forEach(id => element(id).addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => { dragStart = null; element('custom-ratio-button').focus(); });
  element('ratio-apply').addEventListener('click', () => {
    element('custom-ratio').value = String(draftRatio);
    element('custom-ratio').checked = true;
    element('custom-ratio-description').dataset.configured = 'true';
    setText('custom-ratio-description', `1 : ${draftRatio}`);
    update();
    dialog.close();
  });
  numericInputIds.forEach(id => formatInput(element(id)));
  update();
})();
