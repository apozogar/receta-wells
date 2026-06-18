import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  const currentMenuId = localStorage.getItem('currentMenuId');

  let cloned = req;

  if (token) {
    cloned = cloned.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  if (currentMenuId) {
    const hasMenuParam = cloned.url.includes('menuId=');
    if (!hasMenuParam) {
      const separator = cloned.url.includes('?') ? '&' : '?';
      cloned = cloned.clone({
        url: cloned.url + `${separator}menuId=${currentMenuId}`,
      });
    }
  }

  return next(cloned);
};