import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interfaz para la relación CancionCalificacion
export interface CancionCalificacion {
  id_cancion: number;
  id_calificacion: number;
}

// Interfaz para el recurso Intento
export interface Intento {
  id: number;
  id_cancion: number;
  id_usuario: number;
  id_calificacion: number;
  notas_correctas_max?: number;
  notas_incorrectas_max?: number;
  porcentaje_aciertos?: number;
  porcentaje_error?: number;
  porcentaje_completado?: number;
  fecha?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private api_url = 'http://localhost:3000/';
  private recommendations_url = 'http://localhost:8000/';

  constructor(private http: HttpClient) { }

  // Métodos para CancionCalificacion

  guardarCalificacionCancion(relacion: CancionCalificacion): Observable<CancionCalificacion> {
    return this.http.post<CancionCalificacion>(`${this.api_url}cancion-calificacion`, relacion);
  }

  obtenerTodasLasRelaciones(): Observable<CancionCalificacion[]> {
    return this.http.get<CancionCalificacion[]>(`${this.api_url}cancion-calificacion`);
  }

  obtenerRelacion(id_cancion: number, id_calificacion: number): Observable<CancionCalificacion> {
    return this.http.get<CancionCalificacion>(`${this.api_url}cancion-calificacion/${id_cancion}/${id_calificacion}`);
  }

  eliminarRelacion(id_cancion: number, id_calificacion: number): Observable<any> {
    return this.http.delete<any>(`${this.api_url}cancion-calificacion/${id_cancion}/${id_calificacion}`);
  }

  // Métodos para Intentos

  // OBTENER todos los intentos
  obtenerIntentos(): Observable<Intento[]> {
    return this.http.get<Intento[]>(`${this.api_url}intentos`);
  }

  // OBTENER un intento por id
  obtenerIntento(id: number): Observable<Intento> {
    return this.http.get<Intento>(`${this.api_url}intentos/${id}`);
  }

  // CREAR un intento
  crearIntento(intento: Partial<Intento>): Observable<Intento> {
    return this.http.post<Intento>(`${this.api_url}intentos`, intento);
  }

  // ACTUALIZAR un intento
  actualizarIntento(id: number, intento: Partial<Intento>): Observable<Intento> {
    return this.http.put<Intento>(`${this.api_url}intentos/${id}`, intento);
  }

  // ELIMINAR un intento
  eliminarIntento(id: number): Observable<any> {
    return this.http.delete<any>(`${this.api_url}intentos/${id}`);
  }

  getRecommendations(userId: number): Observable<any> {
    return this.http.get<any>(`${this.recommendations_url}recommendations/${userId}`);
  }
}