/* 선형 상품의 수량 및 손익 계산. UI와 분리해 계산식을 검증합니다. */
(function (root) {
  'use strict';
  function calculatePosition({ entry, stop, risk, side, ratio, mode = 'amount', seed, riskPercent }) {
    const errors = {};
    if (!Number.isFinite(entry) || entry <= 0) errors.entry = '0보다 큰 진입가를 입력해 주세요.';
    if (!Number.isFinite(stop) || stop <= 0) errors.stop = '0보다 큰 손절가를 입력해 주세요.';
    if (mode === 'amount') {
      if (!Number.isFinite(risk) || risk <= 0) errors.risk = '0보다 큰 손절액을 입력해 주세요.';
    } else if (mode === 'seed') {
      if (!Number.isFinite(seed) || seed <= 0) errors.seed = '0보다 큰 전체시드를 입력해 주세요.';
      if (!Number.isFinite(riskPercent) || riskPercent <= 0 || riskPercent > 100) errors.riskPercent = '손절율은 0보다 크고 100 이하인 비율을 입력해 주세요.';
      if (!errors.seed && !errors.riskPercent) {
        risk = seed * (riskPercent / 100);
        if (!Number.isFinite(risk) || risk <= 0) errors.riskPercent = '계산 가능한 범위를 벗어났습니다. 전체시드와 손절율을 조정해 주세요.';
      }
    } else {
      errors.mode = '손절액 계산 기준을 선택해 주세요.';
    }
    if (!['long', 'short'].includes(side)) errors.side = '롱 또는 숏을 선택해 주세요.';
    if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 10 || !Number.isInteger(ratio * 2)) errors.ratio = '손익비는 0.5부터 10까지 0.5 단위로 선택해 주세요.';
    if (!errors.entry && !errors.stop && !errors.side) {
      if (side === 'long' && stop >= entry) errors.stop = '롱의 손절가는 진입가보다 낮아야 합니다.';
      if (side === 'short' && stop <= entry) errors.stop = '숏의 손절가는 진입가보다 높아야 합니다.';
    }
    if (Object.keys(errors).length) return { valid: false, errors };
    const distance = Math.abs(entry - stop);
    const quantity = risk / distance;
    const position = quantity * entry;
    const reward = risk * ratio;
    const target = entry + (side === 'long' ? 1 : -1) * distance * ratio;
    if (target <= 0) return { valid: false, errors: { ratio: '현재 숏 설정의 익절가가 0 이하입니다. 손절가를 진입가에 더 가깝게 조정하거나 손익비를 낮춰 주세요.' } };
    if (![quantity, position, reward, target, distance / entry * 100, distance * ratio / entry * 100].every(Number.isFinite) || quantity <= 0 || target === entry) {
      return { valid: false, errors: { calculation: '계산 가능한 범위를 벗어났습니다. 가격과 손절액을 조정해 주세요.' } };
    }
    return { valid: true, entry, stop, risk, side, ratio, target, quantity, position, reward, distancePercent: distance / entry * 100, targetPercent: distance * ratio / entry * 100 };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { calculatePosition };
  else root.PositionCalculator = { calculatePosition };
})(typeof globalThis !== 'undefined' ? globalThis : this);
