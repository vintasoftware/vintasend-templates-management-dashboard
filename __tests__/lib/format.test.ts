import { EMPTY, formatDate } from '@/lib/format';

// The suite pins TZ=UTC in jest.config.js, so these are stable off-machine.
it('formats an ISO timestamp', () => {
  expect(formatDate('2024-02-01T09:30:00Z')).toBe('Feb 01, 2024 09:30');
});

it('renders a null timestamp as absent — every one in this contract is nullable', () => {
  expect(formatDate(null)).toBe(EMPTY);
  expect(formatDate(undefined)).toBe(EMPTY);
  expect(formatDate('')).toBe(EMPTY);
});

it('renders an unparseable value as absent rather than as "Invalid Date"', () => {
  expect(formatDate('not a date')).toBe(EMPTY);
});
