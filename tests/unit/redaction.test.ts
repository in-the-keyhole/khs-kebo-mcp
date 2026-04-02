import { redactRegex } from '../../src/services/redaction.js';

describe('redactRegex', () => {
  describe('dollar amounts', () => {
    it('redacts simple dollar amounts', () => {
      expect(redactRegex('Budget is $50,000 for Q1')).toBe('Budget is [AMOUNT] for Q1');
    });

    it('redacts million-shorthand amounts', () => {
      expect(redactRegex('Contract worth $1.2M')).toBe('Contract worth [AMOUNT]');
    });

    it('redacts amounts with no comma', () => {
      expect(redactRegex('Cost: $5000')).toBe('Cost: [AMOUNT]');
    });

    it('redacts ranges', () => {
      const result = redactRegex('Between $100,000 and $500,000');
      expect(result).toBe('Between [AMOUNT] and [AMOUNT]');
    });
  });

  describe('email addresses', () => {
    it('redacts email addresses', () => {
      expect(redactRegex('Contact john.doe@acmecorp.com for details')).toBe(
        'Contact [EMAIL] for details',
      );
    });
  });

  describe('phone numbers', () => {
    it('redacts US phone numbers', () => {
      expect(redactRegex('Call us at (555) 867-5309')).toBe('Call us at [PHONE]');
    });

    it('redacts dashed phone numbers', () => {
      expect(redactRegex('Phone: 555-867-5309')).toBe('Phone: [PHONE]');
    });
  });

  describe('preserves non-PII content', () => {
    it('does not strip technical content', () => {
      const text = 'Using React 18, AWS Lambda, and PostgreSQL 16';
      expect(redactRegex(text)).toBe(text);
    });

    it('does not strip industry terms', () => {
      const text = 'Fintech company in the payments space';
      expect(redactRegex(text)).toBe(text);
    });

    it('preserves percentage values', () => {
      const text = 'Achieved 40% reduction in latency';
      expect(redactRegex(text)).toBe(text);
    });
  });
});
