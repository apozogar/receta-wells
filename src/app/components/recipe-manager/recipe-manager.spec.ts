import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { RecipeManager } from './recipe-manager';

describe('RecipeManager', () => {
  let component: RecipeManager;
  let fixture: ComponentFixture<RecipeManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeManager],
      providers: [
        provideRouter([]),
        provideHttpClient(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeManager);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
