import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChildren, QueryList, ElementRef, Renderer2, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import * as Tone from 'tone';
import * as JSZip from 'jszip'; // Asegúrate de tener JSZip instalado
import { ApiService, CancionCalificacion } from '../services/api.service';

@Component({
  selector: 'app-piano',
  templateUrl: './piano.component.html',
  styleUrls: ['./piano.component.css']
})
export class PianoComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('pianoKey') pianoKeys!: QueryList<ElementRef>;
  @ViewChildren('octaveButton') octaveButtons!: QueryList<ElementRef>;
  @ViewChild('pianoContainer') pianoContainer!: ElementRef;
  @ViewChild('sheet') sheet!: ElementRef;
  @ViewChild('selectScore') selectScore!: ElementRef;
  @ViewChild('chatBubble') chatBubble!: ElementRef;
  @ViewChild('speech') speech!: ElementRef;
  @ViewChild('speechContainer') speechContainer!: ElementRef;
  @ViewChild('robot') robot!: ElementRef;
  colorsCheckBox!: HTMLInputElement;
  keysCheckbox!: HTMLInputElement;
  aiCheckbox!: HTMLInputElement;

  synth: Tone.PolySynth = new Tone.PolySynth(Tone.Synth).toDestination();
  octave: number = 3;
  isScore: boolean = false;
  showColors: boolean = true;
  osmd!: OpenSheetMusicDisplay;
  speechSynth: SpeechSynthesis = window.speechSynthesis;
  speaker: boolean = true;
  speechRecognition: SpeechRecognition | null = null;
  isRecording: boolean = true;
  // Bandera para controlar el estado del reconocimiento de voz
  isSpeechRecognitionRunning: boolean = false;
  // Nueva bandera para conocer el estado del componente
  private destroyed: boolean = false;
  

  // Para evitar activaciones repetidas de teclas
  pressedKeys: Set<string> = new Set();

  // Para el manejo de acordes
  expectedChordNotes: string[] = [];
  playedChordNotes: Set<string> = new Set();
  notesArray: string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Las canciones se cargarán desde la BD:
  songs: any[] = [];

  // Se usa el id pasado por URL para guardar la relación de calificación y analítica.
  songId: number | null = null;
  song: any;
  score: any;

  mxlFile: ArrayBuffer | null = null;
  mxlFileBase64: string | null = null;

  // VARIABLES PARA LA CALIFICACIÓN DE LA DIFICULTAD
  difficultyRating: number = 0;
  isRatingMode: boolean = false;
  ratingAttempts: number = 0;

  // VARIABLES PARA LA ANALÍTICA DE INTENTOS
  attemptStart: Date = new Date();
  correctNotes: number = 0;       // Notas correctas tocadas
  incorrectNotes: number = 0;     // Notas incorrectas tocadas
  chordsCompleted: number = 0;    // Cantidad de acordes completados
  totalChords: number = 0;        // Número total de acordes (según la partitura)
  attemptStored: boolean = false; // Bandera para saber si ya se almacenó (o imprimió) la analítica

  constructor(private renderer: Renderer2,
              private route: ActivatedRoute,
              private router: Router,
              private http: HttpClient,
              private apiService: ApiService
            ) { }

  ngOnInit(): void {
    // Si la URL trae un id se descarga y enseña la canción.
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        this.downloadAndTeachSong(+idParam);
      }
    });
    // Cargar la lista de canciones para mostrarlas en el modal o librería.
    this.loadSongs();
    this.initMIDIAccess();

    // Configuración para evitar activaciones repetidas mediante teclado.
    this.renderer.listen('window', 'keydown', (e: KeyboardEvent) => {
      if ("asdfghjklñwetyuopzxcvbnm,".includes(e.key)) {
        const keyElement = this.pianoKeys.find(k => k.nativeElement.dataset.key === e.key)?.nativeElement;
        if (keyElement) {
          const note = keyElement.dataset.note;
          const octave = this.octave + Number(keyElement.dataset.octave);
          const noteId = note + octave;
          if (!this.pressedKeys.has(noteId)) {
            this.pressedKeys.add(noteId);
            this.playNoteOnKeyboard(note, octave.toString());
          }
        }
      }
    });
    
    this.renderer.listen('window', 'keyup', (e: KeyboardEvent) => {
      if ("asdfghjklñwetyuopzxcvbnm,".includes(e.key)) {
        const keyElement = this.pianoKeys.find(k => k.nativeElement.dataset.key === e.key)?.nativeElement;
        if (keyElement) {
          const note = keyElement.dataset.note;
          const octave = this.octave + Number(keyElement.dataset.octave);
          const noteId = note + octave;
          if (this.pressedKeys.has(noteId)) {
            this.pressedKeys.delete(noteId);
            this.releaseNoteOnKeyboard(note, octave.toString());
          }
        }
      }
    });
  }

  navigateToHome(): void {
    this.router.navigate(['home']);
  }

  // Antes de cargar una nueva canción, se guarda la analítica del intento actual si se ha tocado más de 20 notas.
  loadSong(songId: number): void {
    if (this.isScore && !this.attemptStored && (this.correctNotes + this.incorrectNotes) > 20) {
      this.storeAttemptData();
    }
    this.resetAttemptMetrics();
    this.downloadAndTeachSong(songId);
  }

  // Descarga de la canción al dar clic en una tarjeta o cuando la URL trae un id.
  downloadAndTeachSong(id: number): void {
    // Guardamos el id de la canción para la calificación y analítica.
    this.songId = id;
    const url = `http://localhost:3000/canciones/download/${id}`;
    this.http.get(url, { responseType: 'blob' }).subscribe(
      (blob: Blob) => {
        this.loadMXLFile(blob).then((scoreString: string | null) => {
          if (scoreString) {
            this.isScore = true;
            this.renderer.removeClass(this.sheet, 'hidden');
            // Renderizar la partitura con un pequeño retraso, por ejemplo 3000 ms.
            this.renderScore(scoreString, 3000);
            // Ocultar el selector de canciones si se estaba mostrando.
            this.renderer.addClass(this.selectScore.nativeElement, 'hidden');
            // Se simula un click en el botón de cierre del modal (si se usa offcanvas).
            const btnClose = this.renderer.selectRootElement('.btn-close', true);
            btnClose.click();
          } else {
            console.error('No se pudo cargar el score a partir del archivo MXL.');
          }
        });
      },
      (error) => {
        console.error('Error al cargar el archivo MXL:', error);
      }
    );
  }

  // Llama al endpoint para obtener la lista de canciones desde la BD.
  loadSongs(): void {
    this.http.get<any[]>('http://localhost:3000/canciones').subscribe(
      (data) => {
        this.songs = data;
      },
      (error) => {
        console.error('Error al cargar la lista de canciones:', error);
      }
    );
  }

  async loadMXLFile(blob: Blob) {
    try {
      const zip = await JSZip.loadAsync(blob);
      const containerFile = zip.file('META-INF/container.xml');
      if (!containerFile) {
        throw new Error('No se encontró el archivo container.xml en el archivo .mxl');
      }
      const containerString = await containerFile.async('text');
      const parser = new DOMParser();
      const containerXml = parser.parseFromString(containerString, 'text/xml');
      const rootfile = containerXml.querySelector('rootfile');
      if (!rootfile) {
        throw new Error('No se encontró el archivo XML principal en container.xml');
      }
      const xmlPath = rootfile.getAttribute('full-path');
      if (!xmlPath) {
        throw new Error('Atributo "full-path" no encontrado en rootfile.');
      }
      const xmlFile = zip.file(xmlPath);
      if (!xmlFile) {
        throw new Error(`No se encontró el archivo XML en la ruta ${xmlPath}`);
      }
      const xmlString = await xmlFile.async('text');
      return xmlString;
    } catch (error) {
      console.error('Error al procesar el archivo .mxl:', error);
      return null;
    }
  }

  ngOnDestroy(): void {
    // Indica que el componente se está destruyendo para que no se reinicie el reconocimiento
    this.destroyed = true;
    // Se detiene el reconocimiento de voz.
    try {
      this.speechRecognition?.stop();
      this.isSpeechRecognitionRunning = false;
    } catch (err) {
      console.error('Error al detener el reconocimiento de voz:', err);
    }
    // Si aún no se ha almacenado el intento y se acumularon más de 20 notas, se guarda al destruir el componente.
    if (!this.attemptStored && this.isScore && (this.correctNotes + this.incorrectNotes) > 20) {
      this.storeAttemptData();
    }
  }

  ngAfterViewInit(): void {
    // Selección de elementos de la interfaz (checkboxes, contenedores, etc.).
    this.colorsCheckBox = this.renderer.selectRootElement('.colors-checkbox input');
    this.keysCheckbox = this.renderer.selectRootElement('.keys-checkbox input');
    this.aiCheckbox = this.renderer.selectRootElement('.ai-checkbox input');
    this.sheet = this.renderer.selectRootElement('#sheet');

    // Listener para mostrar/ocultar las teclas.
    this.keysCheckbox.addEventListener('change', () => {
      this.pianoKeys.forEach(key => {
        key.nativeElement.classList.toggle('hide');
      });
    });

    // Alternar los colores.
    this.colorsCheckBox.addEventListener('change', () => this.showColors = !this.showColors);

    // Alternar la asistencia de la IA.
    this.aiCheckbox.addEventListener('change', () => this.speaker = !this.speaker);

    // Eventos de mouse en cada tecla (mousedown y mouseup).
    this.pianoKeys.forEach((key) => {
      this.renderer.listen(key.nativeElement, 'mousedown', () => {
        const note = key.nativeElement.dataset.note;
        const octave = this.octave + Number(key.nativeElement.dataset.octave);
        const noteId = note + octave;
        if (!this.pressedKeys.has(noteId)) {
          this.pressedKeys.add(noteId);
          this.playNoteOnKeyboard(note, octave.toString());
        }
      });
      this.renderer.listen(key.nativeElement, 'mouseup', () => {
        const note = key.nativeElement.dataset.note;
        const octave = this.octave + Number(key.nativeElement.dataset.octave);
        const noteId = note + octave;
        if (this.pressedKeys.has(noteId)) {
          this.pressedKeys.delete(noteId);
          this.releaseNoteOnKeyboard(note, octave.toString());
        }
      });
    });

    // Botones de cambio de octava.
    this.octaveButtons.forEach((button) => {
      this.renderer.listen(button.nativeElement, 'click', () => {
        if (button.nativeElement.dataset.action === '-' && this.octave > 0) {
          this.octave--;
        } else if (button.nativeElement.dataset.action === '+' && this.octave < 5) {
          this.octave++;
        }
      });
    });

    // Inicializar OpenSheetMusicDisplay.
    this.osmd = new OpenSheetMusicDisplay('sheet', {
      drawingParameters: "compacttight",
      autoResize: true,
      pageFormat: 'Endless',
      renderSingleHorizontalStaffline: true
    });
    if (!this.isScore) {
      this.renderer.addClass(this.sheet, 'hidden');
    }

    // Mensaje de bienvenida.
    setTimeout(() => this.speakText('¡Hola, estoy aquí para ayudarte!'), 500);

    // Configurar listener para reiniciar el reconocimiento de voz.
    this.speechContainer.nativeElement.addEventListener('click', () => {
      if (!this.isRecording) {
        this.isRecording = true;
        try {
          this.speechRecognition?.start();
          this.isSpeechRecognitionRunning = true;
        } catch (err) {
          console.error('Error al iniciar reconocimiento desde click:', err);
        }
        this.speech.nativeElement.textContent = '';
        this.renderer.removeClass(this.speechContainer.nativeElement, 'contract');
      }
    });
    

    // Configurar listener para reiniciar el reconocimiento de voz si se hace clic:
    this.speechContainer.nativeElement.addEventListener('click', () => {
      if (!this.isRecording) {
        this.isRecording = true;
        try {
          this.speechRecognition?.start();
          this.isSpeechRecognitionRunning = true;
        } catch (err) {
          console.error('Error al iniciar reconocimiento desde click:', err);
        }
        this.speech.nativeElement.textContent = '';
        this.renderer.removeClass(this.speechContainer.nativeElement, 'contract');
      }
    });

    this.initializeSpeechRecognition();
  }

  playNoteOnKeyboard(note: string, octave: string): void {
    this.synth.triggerAttack(note + octave);
    this.highlightKey(note, octave, true);
    
    if (this.isScore) {
      // Si se trata del modo partitura, se maneja la nota correctamente y se suma a la analítica.
      if (this.expectedChordNotes.includes(note) && !this.playedChordNotes.has(note)) {
        this.correctNotes++;
      }
      this.playedChordNotes.add(note);
      this.handleScoreAndSpeech(note, octave);
    } else {
      // En modo práctica se traduce la letra a número antes de decirla.
      const numeroNota = this.translateNoteToSpanish(note);
      this.speakText(numeroNota);
    }
  }
  

  releaseNoteOnKeyboard(note: string, octave: string): void {
    this.synth.triggerRelease(note + octave);
    this.highlightKey(note, octave, false);
    this.playedChordNotes.delete(note);
  }

  highlightKey(note: string, octave: string, isActive: boolean): void {
    const keyElement = this.pianoKeys.find(k =>
      k.nativeElement.dataset.note === note &&
      k.nativeElement.dataset.octave == Number(octave) - this.octave
    )?.nativeElement;
    if (keyElement) {
      if (isActive) {
        keyElement.classList.add('active');
        const color = this.colorBackground(note);
        if (this.showColors) {
          this.renderer.addClass(this.pianoContainer.nativeElement, color);
        }
      } else {
        keyElement.classList.remove('active');
        const color = this.colorBackground(note);
        if (this.showColors) {
          this.renderer.removeClass(this.pianoContainer.nativeElement, color);
        }
      }
    }
  }

  updateExpectedChordNotes(): void {
    // Actualiza el acorde esperado a partir del cursor.
    this.expectedChordNotes = this.osmd.cursor.NotesUnderCursor().map(n => this.notesArray[n.halfTone % 12]);
  }

  handleScoreAndSpeech(note: string, octave: string): void {
    if (this.isScore) {
      if (this.expectedChordNotes.includes(note)) {
        // Se verifica si se han tocado todas las notas del acorde esperado.
        const chordCompleted = this.expectedChordNotes.every(n => this.playedChordNotes.has(n));
        if (chordCompleted) {
          this.chordsCompleted++;

          this.playedChordNotes.clear();
          this.osmd.cursor.next();
          this.updateExpectedChordNotes();
          if (this.expectedChordNotes.length > 0) {
            const currentNotesSpelled = this.spellNotes(this.expectedChordNotes);
            this.speakText(currentNotesSpelled);
          } else {
            // Fin de la partitura: se solicita la calificación y, al finalizar, se almacena la analítica.
            this.speakText('¡Has terminado la melodía! Buen trabajo. ¿Qué dificultad te pareció la canción? Califica la canción en una escala del uno al cinco.');
            this.activateRatingMode();
            // En este caso, se almacenará el intento luego de recibir la calificación.
            // Por eso no se invoca storeAttemptData de inmediato.
          }
        }
      } else {
        // Si la nota no corresponde al acorde esperado, se cuenta como incorrecta.
        this.incorrectNotes++;
        const correctNotesSpelled = this.spellNotes(this.expectedChordNotes);
        if (this.expectedChordNotes.length > 1) {
          this.speakText('¡Nota incorrecta!, toca las notas: ' + correctNotesSpelled);
        } else {
          this.speakText('¡Nota incorrecta!, toca la nota: ' + correctNotesSpelled);
        }
      }
    } else {
      this.speakText(note);
    }
  }

  spellNotes(notes: string[]): string {
    // Definición del orden de las notas. Puedes ajustar estos valores si lo deseas.
    const noteOrder: { [key: string]: number } = {
      'C': 1,
      'D': 2,
      'E': 3,
      'F': 4,
      'G': 5,
      'A': 6,
      'B': 7,
      'C#': 8,
      'D#': 9,
      'F#': 10,
      'G#': 11,
      'A#': 12
    };
  
    // Se crea una copia del arreglo y se ordena usando el mapeo anterior.
    const notasOrdenadas = [...notes].sort((a, b) => {
      return (noteOrder[a] || 0) - (noteOrder[b] || 0);
    });
  
    // Se traduce cada nota a su representación en "número" (o palabra) según la lógica original.
    return notasOrdenadas.map(note => {
      switch (note) {
        case 'C#': return '8';
        case 'D#': return '9';
        case 'F#': return '10';
        case 'G#': return '11';
        case 'A#': return '12';
        default:
          return this.translateNoteToSpanish(note);
      }
    }).join(', ');
  }

  translateNoteToSpanish(note: string): string {
    const noteTranslations: { [key: string]: string } = {
         'C': '1',
         'C#': '8',
         'D': '2',
         'D#': '9',
         'E': '3',
         'F': '4',
         'F#': '10',
         'G': '5',
         'G#': '11',
         'A': '6',
         'A#': '12',
         'B': '7'
        };
    
    return noteTranslations[note] || note;
  }

  activateRatingMode(): void {
    this.isRatingMode = true;
    this.ratingAttempts = 0;
    // Se espera que el usuario responda mediante reconocimiento de voz.
  }

  initMIDIAccess(): void {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({ sysex: true })
        .then((midiAccess) => this.onMIDISuccess(midiAccess as WebMidi.MIDIAccess), this.onMIDIFailure.bind(this));
    } else {
      console.log("No MIDI support in your browser.");
    }
  }

  onMIDISuccess(midiAccess: WebMidi.MIDIAccess): void {
    midiAccess.inputs.forEach(input => {
      input.onmidimessage = this.handleMIDIMessage.bind(this);
    });
  }

  onMIDIFailure(): void {
    console.error("Failed to get MIDI access.");
  }

  handleMIDIMessage(message: WebMidi.MIDIMessageEvent): void {
    const command = message.data[0];
    const noteNumber = message.data[1];
    const velocity = message.data[2];
    const key = this.midiNumberToNote(noteNumber);
    const note = key[0];
    const octave = key[1];
    const noteId = note + octave;
    if (command === 144 && velocity > 0) {
      if (!this.pressedKeys.has(noteId)) {
        this.pressedKeys.add(noteId);
        this.playNoteOnKeyboard(note, octave);
      }
    } else if ((command === 128) || (command === 144 && velocity === 0)) {
      if (this.pressedKeys.has(noteId)) {
        this.pressedKeys.delete(noteId);
        this.releaseNoteOnKeyboard(note, octave);
      }
    }
  }

  midiNumberToNote(midiNumber: number): string[] {
    const octave = Math.floor(midiNumber / 12) - 1;
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const note = notes[midiNumber % 12];
    return [note, octave.toString()];
  }

  renderScore(score: string, timeout = 1500) {
    this.osmd.load(score).then(() => {
      this.osmd.render();
      this.osmd.cursor.show();
      this.updateExpectedChordNotes();
      // Se guarda el inicio del intento.
      this.attemptStart = new Date();
      // Se determina el total de acordes usando MeasureList (o SourceMeasures si MeasureList no existe).
      if (this.osmd.Sheet && (<any>this.osmd.Sheet).MeasureList) {
        this.totalChords = (<any>this.osmd.Sheet).MeasureList.length;
      } else if (this.osmd.Sheet && this.osmd.Sheet.SourceMeasures) {
        this.totalChords = this.osmd.Sheet.SourceMeasures.length;
      } else {
        this.totalChords = 0;
      }
      if (this.expectedChordNotes.length > 0) {
        const currentNotesSpelled = this.spellNotes(this.expectedChordNotes);
        setTimeout(() => { this.speakText('¡Vamos a comenzar! Toca: ' + currentNotesSpelled); }, timeout);
      } else {
        setTimeout(() => { this.speakText('La partitura está vacía.'); }, 1500);
      }
    });
  }

  colorBackground(note: string) {
    if ('C#D#E'.includes(note)) {
      return 'background1';
    } else if ('F#G#'.includes(note)) {
      return 'background2';
    } else if ('A#B'.includes(note)) {
      return 'background3';
    }
    return '';
  }

  speakText(text: string): void {
    if (this.speaker) {
      if (!this.speechSynth) {
        console.error('Speech synthesis not supported in this browser.');
        return;
      }
      // Se detiene el reconocimiento antes de emitir el mensaje (para evitar interferencias)
      try {
        this.speechRecognition?.stop();
        this.isSpeechRecognitionRunning = false;
      } catch (err) {
        console.error('Error al detener reconocimiento:', err);
      }
      this.speechSynth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      utterance.onstart = () => {
        this.renderer.addClass(this.robot.nativeElement, 'robotAnimation');
        this.renderer.addClass(this.chatBubble.nativeElement, 'chatAnimation');
      };
      utterance.onend = () => {
        this.renderer.removeClass(this.robot.nativeElement, 'robotAnimation');
        this.renderer.removeClass(this.chatBubble.nativeElement, 'chatAnimation');
        // Reiniciamos el reconocimiento solo si el componente sigue activo
        this.isRecording = true;
        if (!this.destroyed) {
          try {
            this.speechRecognition?.start();
            this.isSpeechRecognitionRunning = true;
          } catch (err) {
            console.error('Error al reiniciar reconocimiento tras speechSynth:', err);
          }
        }
      };
      this.speechSynth.speak(utterance);
    }
    this.chatBubble.nativeElement.textContent = text;
  }


  initializeSpeechRecognition(): void {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.lang = 'es-ES';
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.onresult = (event) => {
        const lastResult = event.results[event.resultIndex];
        const text = lastResult[0].transcript.trim();
        this.speech.nativeElement.textContent = text;
        // Normalizamos a minúsculas sin acentos y se procesa el comando de voz.
        this.speechCommand(text.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      };
      this.speechRecognition.onend = () => {
        console.log("Reconocimiento de voz finalizado.");
        this.isSpeechRecognitionRunning = false;
        // Reiniciamos el reconocimiento solo si el componente sigue activo y se requiere grabar.
        if (!this.destroyed && this.isRecording) {
          try {
            this.speechRecognition!.start();
            this.isSpeechRecognitionRunning = true;
          } catch (err) {
            console.error("Error al reiniciar reconocimiento en onend:", err);
          }
        }
      };
      this.speechRecognition.onerror = (event) => {
        const errorEvent = event as any;
        console.error('Error en el reconocimiento de voz:', errorEvent);
        if (errorEvent.error === "no-speech") {
          setTimeout(() => {
            if (!this.destroyed && this.isRecording) {
              try {
                this.speechRecognition!.start();
                this.isSpeechRecognitionRunning = true;
              } catch (err) {
                console.error("Error al reiniciar reconocimiento tras 'no-speech':", err);
              }
            }
          }, 1000);
        } else {
          if (!this.destroyed && this.isRecording) {
            try {
              this.speechRecognition!.start();
              this.isSpeechRecognitionRunning = true;
            } catch (err) {
              console.error("Error al reiniciar reconocimiento tras error:", err);
            }
          }
        }
      };

      try {
        this.speechRecognition.start();
        this.isSpeechRecognitionRunning = true;
      } catch (err) {
        console.error("Error al iniciar reconocimiento de voz:", err);
      }
    } else {
      console.warn('Speech recognition not available');
    }
  }

  speechCommand(text: string): void {
    // Modo de calificación de la canción.
    if (this.isRatingMode) {
      // Buscar un dígito entre 1 y 5.
      const digitMatch = text.match(/\b([1-5])\b/);
      if (digitMatch && digitMatch[1]) {
        let rating = parseInt(digitMatch[1]);
        if (rating < 1) { rating = 1; }
        if (rating > 5) { rating = 5; }
        this.difficultyRating = rating;
        this.isRatingMode = false;
        this.ratingAttempts = 0;
        this.speakText(`Se ha registrado la dificultad ${rating}`);
        if (this.songId !== null) {
          // Cuando se completa la partitura y se envía la calificación correctamente,
          // se almacena el intento con la calificación indicada.
          this.storeAttemptData();
          const relacion: CancionCalificacion = {
            id_cancion: this.songId,
            id_calificacion: rating
          };
          this.apiService.guardarCalificacionCancion(relacion).subscribe(
            response => console.log('Calificación guardada', response),
            error => console.error('Error al guardar la calificación', error)
          );
        }
        return;
      }
      // Buscar la palabra equivalente.
      const wordsMatch = text.match(/\b(uno|dos|tres|cuatro|cinco)\b/);
      if (wordsMatch && wordsMatch[1]) {
        const wordsToNumber: { [key: string]: number } = {
          'uno': 1,
          'dos': 2,
          'tres': 3,
          'cuatro': 4,
          'cinco': 5
        };
        let rating = wordsToNumber[wordsMatch[1]];
        if (rating < 1) { rating = 1; }
        if (rating > 5) { rating = 5; }
        this.difficultyRating = rating;
        this.isRatingMode = false;
        this.ratingAttempts = 0;
        this.speakText(`Se ha registrado la dificultad ${rating}`);
        if (this.songId !== null) {
          // Luego de recibir la calificación se almacena el intento.
          this.storeAttemptData();
          const relacion: CancionCalificacion = {
            id_cancion: this.songId,
            id_calificacion: rating
          };
          this.apiService.guardarCalificacionCancion(relacion).subscribe(
            response => console.log('Calificación guardada', response),
            error => console.error('Error al guardar la calificación', error)
          );
        }
        return;
      }
      this.ratingAttempts++;
      if (this.ratingAttempts >= 2) {
        // Al no entender la calificación después de dos intentos, se asigna una calificación intermedia.
        this.difficultyRating = 3;
        this.isRatingMode = false;
        this.ratingAttempts = 0;
        this.speakText(`No se logró entender la calificación. Se asigna una nota intermedia de 3`);
        if (this.songId !== null) {
          this.storeAttemptData();
          const relacion: CancionCalificacion = {
            id_cancion: this.songId,
            id_calificacion: 3
          };
          this.apiService.guardarCalificacionCancion(relacion).subscribe(
            response => console.log('Calificación guardada', response),
            error => console.error('Error al guardar la calificación', error)
          );
        }
      } else {
        this.speakText(`No pude identificar un número del uno al cinco en tu respuesta. Por favor, indica un número del uno al cinco.`);
      }
      return;
    }

    // Comando de voz para volver al inicio
    if (text.includes('inicio') || text.includes('volver al inicio') || text.includes('página principal')) {
      this.speakText('Regresando a la pagina principal.');
      this.navigateToHome();
      return;
    }

    // Comandos de voz habituales.
    if (text.includes('hola')) {
      this.speakText('¡Hola! ¿En qué puedo ayudarte?');
    } else if (text.includes('adios')) {
      this.speakText('¡Hasta luego!');
      setTimeout(() => {
        this.isRecording = false;
        this.renderer.addClass(this.speechContainer.nativeElement, 'contract');
        try {
          this.speechRecognition!.stop();
          this.isSpeechRecognitionRunning = false;
        } catch (err) {
          console.error('Error al detener reconocimiento en "adios":', err);
        }
        this.speech.nativeElement.textContent = '';
      }, 1500);
    } else if (text.includes('repetir') || text.includes('repite') || text.includes('repita')) {
      this.speakText('¡Claro! Repitiendo la cancion.');
      if (this.isScore && this.expectedChordNotes.length > 0) {
        const currentNotesSpelled = this.spellNotes(this.expectedChordNotes);
        this.speakText('Toca: ' + currentNotesSpelled);
      }
    } else if (text.includes('teclado') || text.includes('tecla')) {
      this.speakText('¡Claro! Cambiando el estado del teclado.');
      this.keysCheckbox.click();
    } else if (text.includes('colores')) {
      this.speakText(`¡Claro! ${this.showColors ? "Ocultando" : "Mostrando"} los colores.`);
      this.colorsCheckBox.click();
    } else if (text.includes('partitura') || text.includes('melodia')) {
      this.speakText('¡Claro! Mostrando/ocultando las partituras.');
      this.selectScore.nativeElement.click();
    } else if (text.includes('estrellita')) {
      this.speakText('¡Claro! Cargando “Estrellita, ¿dónde estás?”.');
      this.loadSong(1);
    } else if (text.includes('reinicia')) {
      if (this.isScore) {
        this.speakText('¡Claro! Reiniciando la melodía.');
        this.osmd.cursor.reset();
        this.updateExpectedChordNotes();
        const currentNotesSpelled = this.spellNotes(this.expectedChordNotes);
        this.speakText('Toca: ' + currentNotesSpelled);
      }
    } else if (text.includes('ia') || text.includes('artificial') || text.includes('robot')) {
      if (this.speaker) {
        this.speakText('¡Claro! Desactivando la asistencia de IA.');
        this.aiCheckbox.click();
      } else {
        this.aiCheckbox.click();
        this.speakText('¡Claro! Activando la asistencia de IA.');
      }
    } else if (text.includes('bajar') || text.includes('baja')) {
      this.speakText('¡Claro! Bajando una octava.');
      this.octaveButtons.get(0)!.nativeElement.click();
    } else if (text.includes('subir') || text.includes('sube')) {
      this.speakText('¡Claro! Subiendo una octava.');
      this.octaveButtons.get(1)!.nativeElement.click();
    } else if (text.includes('ayuda')) {
      this.speakText('¡Claro! Puedes pedirme que repita, mostrar el teclado, los colores, las partituras o volver a la pagina principal');
    }
  }

  // Función auxiliar para obtener el id del usuario desde el token almacenado en localStorage.
  extractUserIdFromToken(): number | null {
    const token = localStorage.getItem('token');
    if (!token) {
      return null;
    }
    try {
      // El token se espera en formato JWT: header.payload.signature
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

  // REGISTRA la analítica del intento actual y lo almacena en la BD usando el API Service.
  // Si el intento se termina antes de calificar (difficultyRating es 0), se envía id_calificacion = 6.
  storeAttemptData(): void {
    const totalNotes = this.correctNotes + this.incorrectNotes;
    const porcentajeAciertos = totalNotes > 0 ? (this.correctNotes / totalNotes) * 100 : 0;
    const porcentajeError = totalNotes > 0 ? (this.incorrectNotes / totalNotes) * 100 : 0;
    const completado = (this.expectedChordNotes.length === 0) ? 1 : 0;

    // Si la calificación aún no se asignó (es 0), se asigna 6
    const calificacion = this.difficultyRating === 0 ? 6 : this.difficultyRating;

    const id_usuario = this.extractUserIdFromToken(); // Obtiene el id del usuario desde el token

    // Se arma el objeto a enviar.
    const intentoRecord = {
      id_cancion: this.songId ?? undefined,
      id_usuario: id_usuario ? id_usuario : 1, // Si no se obtiene el id, se asigna 1 por defecto
      id_calificacion: calificacion,
      notas_correctas_max: this.correctNotes,
      notas_incorrectas_max: this.incorrectNotes,
      porcentaje_aciertos: porcentajeAciertos,
      porcentaje_error: porcentajeError,
      porcentaje_completado: completado,
      fecha: new Date().toISOString()
    };

    console.log("Intento registrado:", intentoRecord);

    // Llamada al API para guardar el intento.
    this.apiService.crearIntento(intentoRecord).subscribe(
      response => console.log("Intento almacenado en el servidor", response),
      error => console.error("Error al almacenar el intento:", error)
    );

    this.attemptStored = true;
  }
  
  // Resetea las variables de analítica para comenzar un nuevo intento.
  resetAttemptMetrics(): void {
    this.attemptStart = new Date();
    this.correctNotes = 0;
    this.incorrectNotes = 0;
    this.chordsCompleted = 0;
    this.totalChords = 0;
    this.attemptStored = false;
    this.playedChordNotes.clear();
  }
}
