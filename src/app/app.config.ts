import { ApplicationConfig } from '@angular/core';
 import { provideRouter } from '@angular/router';

 import { provideClientHydration } from '@angular/platform-browser';
 import { provideHttpClient } from '@angular/common/http';

 export const appConfig: ApplicationConfig = {
   providers: [
 provideClientHydration(),provideHttpClient()]
 };