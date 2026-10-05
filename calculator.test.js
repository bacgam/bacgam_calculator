'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePosition } = require('./calculator.js');
const base = { entry: 65000, stop: 64000, risk: 100, side: 'long', ratio: 2 };
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10, `${actual} != ${expected}`);

for (const side of ['long', 'short']) {
  for (const ratio of [1, 2, 3]) {
    test(`${side} 1:${ratio}: 설정한 손절액 및 익절액과 실제 가격 손익이 일치`, () => {
      const input = { ...base, side, ratio, stop: side === 'long' ? 64000 : 66000 };
      const result = calculatePosition(input);
      assert.equal(result.valid, true);
      closeTo(result.quantity, 0.1);
      closeTo(result.position, 6500);
      closeTo(result.target, 65000 + (side === 'long' ? 1 : -1) * 1000 * ratio);
      closeTo(Math.abs(input.entry - input.stop) * result.quantity, input.risk);
      closeTo(Math.abs(result.target - input.entry) * result.quantity, input.risk * ratio);
    });
  }
}
test('소수 가격과 손절액으로 수량 및 금액 계산', () => {
  const result = calculatePosition({ entry: 0.125, stop: 0.12, risk: 2.5, side: 'long', ratio: 3 });
  assert.equal(result.valid, true);
  closeTo(result.quantity, 500);
  closeTo(result.position, 62.5);
  closeTo(result.target, 0.14);
  closeTo(result.reward, 7.5);
});
test('손절액 변경에 비례하는 포지션 크기, 동일한 익절가', () => {
  const a = calculatePosition(base);
  const b = calculatePosition({ ...base, risk: 300 });
  assert.equal(b.position, a.position * 3);
  assert.equal(b.target, a.target);
});
test('손절 방향과 동일한 진입가/손절가를 거부', () => {
  for (const input of [{ ...base, stop: 65000 }, { ...base, stop: 66000 }, { ...base, side: 'short' }]) {
    const result = calculatePosition(input);
    assert.equal(result.valid, false);
    assert.ok(result.errors.stop);
  }
});
test('누락, 0, 음수, 무한대 및 잘못된 선택값 거부', () => {
  for (const field of ['entry', 'stop', 'risk']) for (const value of [undefined, NaN, 0, -1, Infinity]) {
    const result = calculatePosition({ ...base, [field]: value });
    assert.equal(result.valid, false);
    assert.ok(result.errors[field]);
  }
  for (const ratio of [undefined, NaN, Infinity, 0, -0.5, 0.25, 1.1, 9.9, 10.5]) {
    assert.equal(calculatePosition({ ...base, ratio }).valid, false);
  }
  assert.equal(calculatePosition({ ...base, side: 'unknown' }).valid, false);
});
test('숏 익절가가 0 또는 음수일 경우 결과 차단', () => {
  for (const stop of [150, 200]) {
    const result = calculatePosition({ entry: 100, stop, risk: 10, side: 'short', ratio: 2 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.ratio);
  }
});
test('숫자 오버플로 및 표현할 수 없는 익절 가격 차이 차단', () => {
  assert.equal(calculatePosition({ ...base, risk: Number.MAX_VALUE }).valid, false);
  assert.equal(calculatePosition({ entry: Number.MIN_VALUE * 2, stop: Number.MIN_VALUE, risk: 100, side: 'long', ratio: 1 }).valid, false);
});
test('0.5부터 10까지 모든 커스텀 손익비에서 롱/숏 손익 검증', () => {
  for (const side of ['long', 'short']) for (let ratio = 0.5; ratio <= 10; ratio += 0.5) {
    const result = calculatePosition({ ...base, side, ratio, stop: side === 'long' ? 64000 : 66000 });
    assert.equal(result.valid, true);
    closeTo(result.reward, base.risk * ratio);
    closeTo(Math.abs(result.target - base.entry) * result.quantity, result.reward);
    closeTo(result.target, base.entry + (side === 'long' ? 1 : -1) * 1000 * ratio);
  }
});
test('전체시드 비율로 구한 손절액이 직접 입력한 손절액과 동일한 포지션을 산출', () => {
  for (const side of ['long', 'short']) for (const ratio of [0.5, 2, 3.5, 10]) {
    const trade = { ...base, side, ratio, stop: side === 'long' ? 64000 : 66000 };
    const percentBased = calculatePosition({ ...trade, mode: 'seed', seed: 20000, riskPercent: 2.5, risk: NaN });
    const amountBased = calculatePosition({ ...trade, risk: 500 });
    assert.deepEqual(percentBased, amountBased);
  }
});
test('전체시드 비율기준의 빈 값, 잘못된 비율, 음수 및 숫자 범위 검증', () => {
  const trade = { ...base, mode: 'seed', seed: 10000, riskPercent: 1 };
  for (const seed of [undefined, NaN, Infinity, 0, -1]) {
    const result = calculatePosition({ ...trade, seed });
    assert.equal(result.valid, false);
    assert.ok(result.errors.seed);
  }
  for (const riskPercent of [undefined, NaN, Infinity, 0, -1, 100.1]) {
    const result = calculatePosition({ ...trade, riskPercent });
    assert.equal(result.valid, false);
    assert.ok(result.errors.riskPercent);
  }
  assert.equal(calculatePosition({ ...trade, seed: Number.MIN_VALUE, riskPercent: 0.1 }).valid, false);
  assert.equal(calculatePosition({ ...trade, riskPercent: 100 }).valid, true);
  assert.equal(calculatePosition({ ...base, mode: 'unknown' }).valid, false);
});
test('손절액 기준에서는 사용하지 않는 전체시드와 손절율을 무시', () => {
  assert.deepEqual(calculatePosition({ ...base, mode: 'amount', seed: NaN, riskPercent: -1 }), calculatePosition(base));
});
