import { Component, OnInit, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';

// Para compatibilidad con navegadores (Chrome utiliza webkitSpeechRecognition)
declare var webkitSpeechRecognition: any;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  songs2: any[] = [];
  recommendations: any[] = [];  // Lista de recomendaciones
  selectedMode: 'songs' | 'practice' = 'songs';
  currentUserId = -1;

  recognition: any; // Objeto para el reconocimiento de voz
  waitingForRecommendationSelection: boolean = false;  // Espera por el número de recomendación
  waitingForRecomendationConsent: boolean = false;      // Espera por la respuesta a "¿Leo recomendaciones?"
  waitingForModeChoice: boolean = false;                // Espera por la respuesta de: "¿Modo práctica o catálogo?"

  constructor(private http: HttpClient, private router: Router, private apiService: ApiService, private zone: NgZone) { }

  ngOnInit(): void {
    // Obtenemos el id del usuario actual
    this.currentUserId = this.extractUserIdFromToken() || -1;

    // Primero cargamos las canciones para disponer de las imágenes
    this.http.get('http://localhost:3000/canciones').subscribe((data: any) => {
      this.songs2 = data;

      // Una vez cargadas las canciones, solicitamos las recomendaciones
      this.apiService.getRecommendations(this.currentUserId).subscribe(
        (data: any) => {
          if (data && data.recommendations) {
            this.recommendations = data.recommendations;
            // Por cada recomendación, buscamos la canción correspondiente en songs2 para asignarle la imagen
            this.recommendations.forEach(rec => {
              const matchedSong = this.songs2.find(song => song.id === rec.idCancionId);
              if (matchedSong) {
                rec.imagen = matchedSong.imagen;
              }
            });
            console.log('Recomendaciones con imagen:', this.recommendations);
          }
          // Después de cargar recomendaciones, damos la bienvenida y preguntamos si se desean leer
          this.welcomeAndAskRecommendations();
        },
        (error) => {
          console.error('Error al obtener recomendaciones:', error);
          // En caso de error, igual damos la bienvenida
          this.welcomeAndAskRecommendations();
        }
      );
    });

    // Iniciamos el reconocimiento de voz
    this.initVoiceRecognition();
  }

  // Función auxiliar para obtener el id del usuario desde el token almacenado en localStorage.
  extractUserIdFromToken(): number | null {
    const token = localStorage.getItem('token');
    if (!token) {
      return null;
    }
    try {
      // Se espera el token en formato JWT: header.payload.signature
      const payload = token.split('.')[1];
      const payloadDecoded = atob(payload);
      const payloadObj = JSON.parse(payloadDecoded);
      // Se asume que el id del usuario está en la propiedad "sub"
      return Number(payloadObj.sub);
    } catch (error) {
      console.error('Error al extraer el id del usuario del token:', error);
      return null;
    }
  }

  navigateToSong(id: number) {
    this.router.navigate(['piano', id]);
  }

  navigateToPractice() {
    this.router.navigate(['piano']);
  }

  navigateToUploadSong() {
    this.router.navigate(['upload-song']);
  }

  // Da la bienvenida y pregunta si se desea leer las recomendaciones
  welcomeAndAskRecommendations(): void {
    const welcomeMessage = 'Bienvenido a melodias a ciegas. ¿Deseas que lea las recomendaciones?';
    this.say(welcomeMessage);
    this.waitingForRecomendationConsent = true;
  }

  // Inicializa y configura la API de reconocimiento de voz
  initVoiceRecognition(): void {
    const SpeechRecognition = window['SpeechRecognition'] || webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('El navegador no soporta Speech Recognition.');
      return;
    }
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-ES';
    this.recognition.continuous = true;
    this.recognition.interimResults = false;

    this.recognition.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const transcript = event.results[lastResultIndex][0].transcript.trim().toLowerCase();
      console.log('Reconocido:', transcript);
      this.zone.run(() => {
        this.parseVoiceCommand(transcript);
      });
    };

    this.recognition.onend = () => {
      console.log('Reconocimiento de voz finalizado, reiniciando...');
      this.recognition.start();
    };

    this.recognition.onerror = (event: any) => {
      console.error('Error en la API de voz:', event.error);
    };

    this.recognition.start();
  }

  // Procesa de forma flexible los comandos y respuestas del usuario
  parseVoiceCommand(phrase: string): void {
    // Si se espera respuesta sobre la lectura de recomendaciones, se procesa esa entrada
    if (this.waitingForRecomendationConsent) {
      this.handleRecommendationConsent(phrase);
      return;
    }
    // Si se espera respuesta con el número de recomendación, se procesa esa entrada
    if (this.waitingForRecommendationSelection) {
      this.handleRecommendationSelection(phrase);
      return;
    }
    // Si se espera la elección entre modo práctica o catálogo, se procesa esa entrada
    if (this.waitingForModeChoice) {
      this.handleModeChoice(phrase);
      return;
    }

    // Comandos para cambiar a modo Canciones (usando expresiones regulares para ser más flexibles)
    if (phrase.match(/(modo\s*canciones|mostrar\s*canciones|seleccionar\s*canciones)/)) {
      console.log('Cambiando a modo Canciones');
      this.selectedMode = 'songs';
      return;
    }

    // Comandos para cambiar a modo Práctica Libre
    if (phrase.match(/(modo\s*práctica|práctica\s*libre|iniciar\s*práctica)/)) {
      console.log('Cambiando a modo Práctica Libre');
      this.selectedMode = 'practice';
      return;
    }

    // Comando para subir canción
    if (phrase.includes('subir canción')) {
      console.log('Navegando a subir canción');
      this.navigateToUploadSong();
      return;
    }

    // Comando para comenzar práctica libre
    if (phrase.match(/(comenzar\s*práctica|iniciar\s*práctica libre)/)) {
      console.log('Comenzando Práctica Libre');
      this.navigateToPractice();
      return;
    }

    // Comando para abrir una canción a partir de su nombre
    if (phrase.includes('abrir canción') || phrase.includes('seleccionar canción')) {
      let songName = '';
      if (phrase.includes('abrir canción')) {
        songName = phrase.split('abrir canción')[1].trim();
      } else if (phrase.includes('seleccionar canción')) {
        songName = phrase.split('seleccionar canción')[1].trim();
      }
      if (songName) {
        const foundSong = this.songs2.find(song => song.nombre.toLowerCase().includes(songName));
        if (foundSong) {
          console.log('Abriendo canción:', foundSong.nombre);
          this.navigateToSong(foundSong.id);
        } else {
          console.warn('No se encontró la canción con el nombre:', songName);
        }
      }
      return;
    }

  }

  // Función para emitir síntesis de voz
  say(text: string): void {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    window.speechSynthesis.speak(utterance);
  }

  // Lee las recomendaciones enumeradas y pregunta el número de la canción deseada
  readRecommendations(): void {
    if (this.recommendations.length === 0) {
      this.say('No hay recomendaciones disponibles en este momento.');
      return;
    }
    let message = 'Estas son tus recomendaciones. ';
    this.recommendations.forEach((rec, index) => {
      message += `Número ${index + 1}: ${rec.nombre} de ${rec.compositor}. `;
    });
    message += 'Por favor, indica el número de la canción que deseas.';
    this.say(message);
    this.waitingForRecommendationSelection = true;
  }

  // Procesa la respuesta del usuario a la pregunta "¿Deseas que lea las recomendaciones?"
  handleRecommendationConsent(response: string): void {
    // Se consideran afirmativas algunas palabras clave aunque estén en oraciones más largas
    const affirmativeWords = ['sí', 'si', 'claro', 'por supuesto', 'vale', 'ok', 'okay'];
    const negativeWords = ['no', 'nada', 'para nada', 'negativo'];

    if (affirmativeWords.some(word => response.includes(word))) {
      this.say('Muy bien, leeré las recomendaciones.');
      this.waitingForRecomendationConsent = false;
      this.readRecommendations();
    } else if (negativeWords.some(word => response.includes(word))) {
      this.say('Perfecto, continuamos.');
      this.waitingForRecomendationConsent = false;
      // Si el usuario decide no leer las recomendaciones, preguntamos a cuál modo desea ir
      this.askModeChoice();
    } else {
      // Si no se entiende la respuesta se repite la pregunta de forma amigable
      this.say('No entendí tu respuesta. ¿Deseas que lea las recomendaciones? Por favor, responde con sí o no.');
      this.waitingForRecomendationConsent = true;
    }
  }

  // Pregunta al usuario si prefiere ir al modo práctica libre o escoger canción del catálogo
  askModeChoice(): void {
    const message = '¿Prefieres ir al modo de práctica libre o escoger una canción del catálogo?';
    this.say(message);
    this.waitingForModeChoice = true;
  }

  // Procesa la respuesta del usuario para elegir entre modo práctica o catálogo
  handleModeChoice(response: string): void {
    // Se buscan palabras clave en la respuesta para detectar la intención
    if (response.match(/(práctica|practicar|practica)/)) {
      this.say('Muy bien, cambiando al modo de práctica libre.');
      this.waitingForModeChoice = false;
      this.selectedMode = 'practice';
      // Opcionalmente se puede navegar directamente al modo práctica:
      this.navigateToPractice();
    } else if (response.match(/(canción|catálogo|catalogo|seleccionar)/)) {
      this.say('De acuerdo, cambiando al modo de canciones.');
      this.waitingForModeChoice = false;
      this.selectedMode = 'songs';
      // El usuario podrá escoger luego una canción del catálogo.
    } else {
      this.say('No entendí tu respuesta. Por favor, dime si prefieres modo de práctica libre o catálogo de canciones.');
      this.waitingForModeChoice = true;
    }
  }

  // Procesa la respuesta del usuario al preguntar el número de recomendación (se busca cualquier número en la frase)
  handleRecommendationSelection(response: string): void {
    // Se busca cualquier dígito en la respuesta
    const digitMatch = response.match(/\d+/);
    // Y se define un mapa para palabras numéricas
    const numberMap: { [key: string]: number } = {
      'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
      'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10
    };

    let selectedNumber: number | undefined = undefined;
    if (digitMatch && digitMatch[0]) {
      selectedNumber = parseInt(digitMatch[0], 10);
    } else {
      // Si no se encuentra dígito, se busca en la respuesta alguna palabra del mapa
      Object.keys(numberMap).forEach(key => {
        if (response.includes(key)) {
          selectedNumber = numberMap[key];
        }
      });
    }

    if (selectedNumber && selectedNumber >= 1 && selectedNumber <= this.recommendations.length) {
      const selectedRec = this.recommendations[selectedNumber - 1];
      this.say(`Abriendo la canción número ${selectedNumber}: ${selectedRec.nombre} de ${selectedRec.compositor}.`);
      this.navigateToSong(selectedRec.idCancionId);
      this.waitingForRecommendationSelection = false;
    } else {
      this.say('No entendí el número indicado. Por favor, dime nuevamente el número de la canción que deseas.');
      this.waitingForRecommendationSelection = true;
    }
  }
}