import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Calendar } from './calendar';
import { MenuService } from '../../services/menu.service';

describe('Calendar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Calendar],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Calendar);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have correct weekly rules', () => {
    const fixture = TestBed.createComponent(Calendar);
    const comp = fixture.componentInstance;
    expect(comp.rules[1].lunch).toBe('legumbres');
    expect(comp.rules[2].lunch).toBe('verduras');
    expect(comp.rules[5].dinner).toBe('free');
    expect(comp.rules[0].lunch).toBe('arroz');
  });

  it('should start in month view', () => {
    const fixture = TestBed.createComponent(Calendar);
    expect(fixture.componentInstance.viewMode).toBe('month');
  });

  it('should switch to weekly view', () => {
    const fixture = TestBed.createComponent(Calendar);
    const comp = fixture.componentInstance;
    comp.switchToWeekly();
    expect(comp.viewMode).toBe('week');
  });

  it('should return special recipes for special types', () => {
    const fixture = TestBed.createComponent(Calendar);
    const comp = fixture.componentInstance;
    const free = (comp as any).getSpecialRecipe('free');
    expect(free.id).toBe(-1);
    const arroz = (comp as any).getSpecialRecipe('arroz');
    expect(arroz.id).toBe(-2);
  });

  it('should navigate months correctly', () => {
    const fixture = TestBed.createComponent(Calendar);
    const comp = fixture.componentInstance;
    const origMonth = comp.currentMonth;
    const origYear = comp.currentYear;
    (comp as any).navigateMonth(1);
    if (origMonth < 11) {
      expect(comp.currentMonth).toBe(origMonth + 1);
      expect(comp.currentYear).toBe(origYear);
    }
  });
});
