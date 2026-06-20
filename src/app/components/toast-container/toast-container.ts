import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  imports: [CommonModule],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.css',
})
export class ToastContainer implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub?: Subscription;

  constructor(
    private toastService: ToastService,
  ) {}

  ngOnInit() {
    this.sub = this.toastService.toasts$.subscribe(t => {
      this.toasts = t;
      
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  remove(id: number) {
    this.toastService.remove(id);
  }
}
