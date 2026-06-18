import { TestBed } from '@angular/core/testing';

import { Thermomix } from './thermomix';

describe('Thermomix', () => {
  let service: Thermomix;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Thermomix);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateCurlCommand', () => {
    it('should generate a curl command with recipe IDs', () => {
      const ids = new Set(['r123', 'r456']);
      const curl = service.generateCurlCommand('test-cookie', ids);
      expect(curl).toContain('r123');
      expect(curl).toContain('r456');
      expect(curl).toContain('test-cookie');
    });
  });

  describe('getRecipeIdsFromCalendar', () => {
    it('should collect cookidoo IDs from calendar days', () => {
      const days = [
        { lunch: { cookidooId: 'r1' }, dinner: { cookidooId: 'r2' } },
        { lunch: { cookidooId: 'r3' }, dinner: {} },
        { lunch: {}, dinner: {} },
      ] as any;
      const ids = service.getRecipeIdsFromCalendar(days);
      expect(ids.has('r1')).toBe(true);
      expect(ids.has('r2')).toBe(true);
      expect(ids.has('r3')).toBe(true);
      expect(ids.size).toBe(3);
    });
  });
});
