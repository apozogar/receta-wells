import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ConfirmRequest {
  message: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private confirmSubject = new Subject<ConfirmRequest>();
  confirm$ = this.confirmSubject.asObservable();

  confirm(message: string): Promise<boolean> {
    return new Promise(resolve => {
      this.confirmSubject.next({ message, resolve });
    });
  }
}
