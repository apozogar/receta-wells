import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmService, ConfirmRequest } from '../../services/confirm.service';

@Component({
  selector: 'app-confirm-modal',
  imports: [CommonModule],
  templateUrl: './confirm-modal.html',
  styleUrl: './confirm-modal.css',
})
export class ConfirmModal implements OnInit, OnDestroy {
  message = '';
  show = false;
  private currentResolve?: (value: boolean) => void;
  private sub?: Subscription;

  constructor(
    private confirmService: ConfirmService,
  ) {}

  ngOnInit() {
    this.sub = this.confirmService.confirm$.subscribe((req: ConfirmRequest) => {
      this.message = req.message;
      this.currentResolve = req.resolve;
      this.show = true;
      
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  confirm() {
    this.show = false;
    this.currentResolve?.(true);
    
  }

  cancel() {
    this.show = false;
    this.currentResolve?.(false);
    
  }
}
