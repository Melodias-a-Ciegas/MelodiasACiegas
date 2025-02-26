// login.component.ts
import { Component, Inject } from '@angular/core';
import { ApiService } from './../services/api.service';
import { OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  name: string = '';
  email: string = '';
  password: string = '';
  rememberMe: boolean = false;

  credentials = {email: '', password: ''};

  registerName: string = '';
  registerEmail: string = '';
  registerPassword: string = '';
  confirmPassword: string = '';

  registerCredentials = {nombre: '', correo: '', contrasenia: ''};

  isRegistering: boolean = false;

  isRegistered: boolean = false;

  message: string = '';

  constructor(@Inject(ApiService) private apiService: ApiService, private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    if(localStorage.getItem('token')) {
      this.router.navigate(['home']);
    }
  }


  login() {
    this.authService.login(this.credentials).subscribe(
      (response: any) => {
        if(response === undefined || response === null || !response) {
          alert('Usuario o contraseña incorrectos');
          return;
        }
        console.log('Login response', response);
        localStorage.setItem('token', response.token);
        this.router.navigate(['home']);
        console.log('Local Storage token: ', localStorage.getItem('token'));
      },
      (error: any) => {
        console.error('Error logging in', error);
      }
    );
  }


  register() {

    this.authService.register(this.registerCredentials).subscribe(
      (response: any) => {
        if(response === undefined || !response) {
          alert('Error al registrar el usuario');
          return;
        } else if(response === null) {
          alert('El usuario ya existe');
          return;
        }

        console.log('Register response', response);
        localStorage.setItem('token', response.token);
        this.router.navigate(['home']);
      },
      (error: any) => {
        console.error('Error registrando al usuario', error);
        alert('Ha ocurrido un error, vuelva a intentarlo');
      }
    );
  }

  showRegisterForm() {
    this.isRegistering = true;
  }

  showLoginForm() {
    this.isRegistering = false;
  }
}