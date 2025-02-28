import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Injectable()
export class GuestGuard implements CanActivate {
constructor(private authService: AuthService, private router: Router) {}

canActivate(): boolean {
if (this.authService.isAuthenticated()) {
this.router.navigate(['/home']);
return false;
}
return true;
}
}