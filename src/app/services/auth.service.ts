import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, credentials);
  }

  logout() {
    localStorage.removeItem('token');
  }

  register(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, user);
  }

  public isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    // Agregar lógica para verificar si el token es válido
    if (!token) {
      return false;
    }



    // Lógica adicional para verificar la validez del token

    const tokenPayload = JSON.parse(atob(token.split('.')[1]));
    const expirationDate = new Date(tokenPayload.exp * 1000);
    if (expirationDate < new Date()) {
      localStorage.removeItem('token');
      return false;
    }

    return true;
  }

  public getToken(): string | null {
    return localStorage.getItem('token');
  }
}