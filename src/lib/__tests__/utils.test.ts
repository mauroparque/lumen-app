import { describe, it, expect } from 'vitest';
import { formatPhoneNumber, cn } from '../utils';

describe('formatPhoneNumber', () => {
    it('removes non-numeric characters', () => {
        const result = formatPhoneNumber('+54 11 1234-5678');
        expect(result).toBe('541112345678');
    });

    it('adds 549 prefix to 10-digit numbers (Argentina mobile)', () => {
        const result = formatPhoneNumber('11 1234 5678');
        expect(result).toBe('5491112345678');
    });

    it('returns empty string for empty input', () => {
        const result = formatPhoneNumber('');
        expect(result).toBe('');
    });

    it('replaces leading 0 with 549 prefix', () => {
        const result = formatPhoneNumber('0111234567');
        expect(result).toBe('549111234567');
    });

    it('handles null/undefined gracefully', () => {
        expect(formatPhoneNumber(undefined as any)).toBe('');
        expect(formatPhoneNumber(null as any)).toBe('');
    });

    it('does not double-prefix numbers already starting with 549', () => {
        const result = formatPhoneNumber('5491112345678');
        expect(result).toBe('5491112345678');
    });

    it('handles numbers with + prefix', () => {
        const result = formatPhoneNumber('+5491112345678');
        expect(result).toBe('5491112345678');
    });
});

describe('cn (classnames utility)', () => {
    it('merges class names', () => {
        const result = cn('base-class', 'another-class');
        expect(result).toContain('base-class');
        expect(result).toContain('another-class');
    });

    it('handles conditional classes', () => {
        const isActive = true;
        const result = cn('base', isActive && 'active');
        expect(result).toContain('active');
    });

    it('filters out falsy values', () => {
        const result = cn('base', false && 'hidden', null, undefined);
        expect(result).toBe('base');
    });

    it('handles empty call', () => {
        const result = cn();
        expect(result).toBe('');
    });
});
