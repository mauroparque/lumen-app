import { describe, it, expect, vi } from 'vitest';
import { formatPhoneNumber, cn, calculateAge, isOverdue } from '../utils';

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
        const shouldHide = false;
        const result = cn('base', shouldHide && 'hidden', null, undefined);
        expect(result).toBe('base');
    });

    it('handles empty call', () => {
        const result = cn();
        expect(result).toBe('');
    });
});

describe('calculateAge', () => {
    it('retorna edad correcta para fecha pasada', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01'));

        expect(calculateAge('1990-06-15')).toBe(35);

        vi.useRealTimers();
    });

    it('retorna edad decrementada si aún no cumplió años este año', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01'));

        expect(calculateAge('1990-12-25')).toBe(35);

        vi.useRealTimers();
    });

    it('retorna null si birthDate es undefined', () => {
        expect(calculateAge(undefined)).toBeNull();
    });

    it('retorna null si birthDate es string vacío', () => {
        expect(calculateAge('')).toBeNull();
    });
});

describe('isOverdue', () => {
    it('retorna true si la cita ya pasó (más de 1 hora)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01T15:00:00'));

        expect(isOverdue({ date: '2026-03-01', time: '10:00' })).toBe(true);

        vi.useRealTimers();
    });

    it('retorna false si la cita es futura', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01T09:00:00'));

        expect(isOverdue({ date: '2026-03-01', time: '10:00' })).toBe(false);

        vi.useRealTimers();
    });

    it('retorna false si la cita es hoy y dentro de la ventana de 1h', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01T10:30:00'));

        expect(isOverdue({ date: '2026-03-01', time: '10:00' })).toBe(false);

        vi.useRealTimers();
    });

    it('maneja time ausente usando 00:00 como default', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01T15:00:00'));

        expect(isOverdue({ date: '2026-03-01' })).toBe(true);

        vi.useRealTimers();
    });
});
