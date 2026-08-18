import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { optionalDate, optionalEnum, optionalMoney, strictDecimal } from '../src/common/integrity';
import { normalizedPayment } from '../src/resources/payment-transactions.controller';
import { safeFieldNames } from '../src/common/audit.interceptor';

describe('financial integrity validation', () => {
  it('rejects malformed, negative, and over-precision money instead of silently storing zero', () => {
    assert.throws(() => optionalMoney('not-a-number', 'amount'), BadRequestException);
    assert.throws(() => optionalMoney('-0.01', 'amount'), BadRequestException);
    assert.throws(() => optionalMoney('1.001', 'amount'), BadRequestException);
    assert.equal(optionalMoney('12.5', 'amount'), '12.50');
  });

  it('validates actual calendar dates and enums', () => {
    assert.equal(optionalDate('2026-02-28', 'date'), '2026-02-28');
    assert.throws(() => optionalDate('2026-02-30', 'date'), BadRequestException);
    assert.throws(() => optionalEnum('Maybe', 'flag', ['', 'Y', 'N']), BadRequestException);
  });

  it('accepts percentages only in the fractional database range', () => {
    assert.equal(strictDecimal('0.1000', 'rate', { min: 0, max: 1, scale: 4 }).toFixed(4), '0.1000');
    assert.throws(() => strictDecimal('1.0001', 'rate', { min: 0, max: 1, scale: 4 }), BadRequestException);
  });

  it('never treats malformed numeric input as zero', () => {
    assert.throws(() => strictDecimal('abc', 'rate', { min: 0, max: 100, scale: 4 }), BadRequestException);
  });

  it('requires exactly one positive debit or credit', () => {
    const debit = normalizedPayment({
      transactionDate: '2026-08-17', vendorName: 'Creator', utrOrRef: 'UTR-1',
      debitAmount: '100', creditAmount: '0',
    });
    assert.equal(debit.debitAmount, '100.00');
    assert.throws(() => normalizedPayment({
      transactionDate: '2026-08-17', vendorName: 'Creator', utrOrRef: 'UTR-2',
      debitAmount: '100', creditAmount: '10',
    }), BadRequestException);
    assert.throws(() => normalizedPayment({
      transactionDate: '2026-08-17', vendorName: 'Creator', utrOrRef: 'UTR-3',
      debitAmount: '0', creditAmount: '0',
    }), BadRequestException);
  });

  it('audit metadata records field names without secret or file fields', () => {
    assert.deepEqual(
      safeFieldNames({ amount: 10, password: 'hidden', token: 'hidden', file: 'hidden', notes: 'ok' }),
      ['amount', 'notes'],
    );
  });
});
