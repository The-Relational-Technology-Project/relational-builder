import { describe, expect, it } from 'vitest';
import { armAfterReply, autoFixPassLimit, mayAutoFix } from './fix-passes';

describe('automatic fix passes', () => {
  it('one pass off the flag, two on it', () => {
    expect(autoFixPassLimit(false)).toBe(1);
    expect(autoFixPassLimit(true)).toBe(2);
  });

  it('a build or a finished chain arms a fresh pass', () => {
    expect(armAfterReply({ wasFix: false, wasContinuation: false, lastFixWasAuto: false, passesUsed: 2, humanScale: true })).toEqual({ armed: true, passesUsed: 0 });
    expect(armAfterReply({ wasFix: true, wasContinuation: true, lastFixWasAuto: true, passesUsed: 1, humanScale: false })).toEqual({ armed: true, passesUsed: 0 });
  });

  it('after the first automatic fix, a second is armed only behind the flag', () => {
    expect(armAfterReply({ wasFix: true, wasContinuation: false, lastFixWasAuto: true, passesUsed: 1, humanScale: false }).armed).toBe(false);
    expect(armAfterReply({ wasFix: true, wasContinuation: false, lastFixWasAuto: true, passesUsed: 1, humanScale: true }).armed).toBe(true);
    expect(armAfterReply({ wasFix: true, wasContinuation: false, lastFixWasAuto: true, passesUsed: 2, humanScale: true }).armed).toBe(false);
  });

  it("a person's own fix never re-arms it", () => {
    expect(armAfterReply({ wasFix: true, wasContinuation: false, lastFixWasAuto: false, passesUsed: 1, humanScale: true }).armed).toBe(false);
  });

  it('the second pass fires only for a different error', () => {
    expect(mayAutoFix({ passesUsed: 0, errorSignature: 'a', lastFixSignature: 'a' })).toBe(true);
    expect(mayAutoFix({ passesUsed: 1, errorSignature: 'a', lastFixSignature: 'a' })).toBe(false);
    expect(mayAutoFix({ passesUsed: 1, errorSignature: 'b', lastFixSignature: 'a' })).toBe(true);
  });
});
