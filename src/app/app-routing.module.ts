import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './auth.guard';

import { LoginComponent } from './login/login.component';
import { PianoComponent } from './piano/piano.component';
import { HomeComponent } from './home/home.component';
import { GuestGuard } from './guest-guard.guard';
import { UploadSongComponent } from './upload-song/upload-song.component';

const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent, canActivate: [GuestGuard] },
  { path: 'piano/:id', component: PianoComponent, canActivate: [AuthGuard] }, // Enviar el id de la cancion
  { path: 'piano', component: PianoComponent, canActivate: [AuthGuard] },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'upload-song', component: UploadSongComponent, canActivate: [AuthGuard] },
  
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
