import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import * as JSZip from 'jszip';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

@Component({
  selector: 'app-upload-song',
  templateUrl: './upload-song.component.html',
  styleUrl: './upload-song.component.css'
})
export class UploadSongComponent{

  songForm: FormGroup;
  imageFile: File | null = null;
  compressedXMLFile: File | null = null;
  uploadURL = 'http://localhost:3000/canciones'; // Ajusta la URL segun corresponda

  mxlFile: ArrayBuffer | null = null;

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router) {
    this.songForm = this.fb.group({
      nombre: ['', Validators.required]
    });
  }

  onImageChange(event: any) {
    const file = event.target.files[0]; 
    if (file) {
      this.imageFile = file;
    }
  }

  onXMLChange(event: any) {
    const file = event.target.files[0];
    console.log('Archivo XML cargado:', event);
    if (file) {
      this.compressedXMLFile = file;
    }
  }

  onSubmit() {
    if (this.songForm.invalid || !this.compressedXMLFile) {
      return;
    }

    const formData = new FormData();
    formData.append('nombre', this.songForm.get('nombre')?.value);
    formData.append('archivo', this.compressedXMLFile);
    if (this.imageFile) {
      formData.append('imagen', this.imageFile);
    }

    this.http.post(this.uploadURL, formData).subscribe(
      res => { console.log('Canción subida exitosamente', res); },
      err => { console.error('Error al subir la canción', err); }
    );
  }

  
  navigateToHome() {
    this.router.navigate(['home']);
  }



}

