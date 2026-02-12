import {describe, expect, test} from '@jest/globals';
import {multiply} from './multiply';

describe('multiply module', () => {
  test('multiplies 1 * 2 to equal 2', () => {
    expect(multiply(1, 2)).toBe(2);
  });
});