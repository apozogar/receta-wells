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
});
