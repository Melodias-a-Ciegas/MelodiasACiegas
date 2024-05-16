import { Component, OnInit, ViewChildren, QueryList, ElementRef, Renderer2, AfterViewInit, ViewChild } from '@angular/core';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import * as Tone from 'tone';

@Component({
  selector: 'app-piano',
  templateUrl: './piano.component.html',
  styleUrls: ['./piano.component.css']
})
export class PianoComponent implements OnInit, AfterViewInit {
  @ViewChildren('pianoKey') pianoKeys!: QueryList<ElementRef>;
  @ViewChildren('octaveButton') octaveButtons!: QueryList<ElementRef>;
  @ViewChildren('score') scores!: QueryList<ElementRef>;
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

  constructor(private renderer: Renderer2) { }

  ngOnInit(): void {
    this.initMIDIAccess();
    this.renderer.listen('window', 'keydown', (e: KeyboardEvent) => {
      if ("asdfghjklñwetyuopzxcvbnm,".includes(e.key)) {
        const keyElement = this.pianoKeys.find(k => k.nativeElement.dataset.key === e.key)?.nativeElement;
        const octave = this.octave + Number(keyElement.dataset.octave);
        this.playTuneForKeyboard(keyElement.dataset.note, octave.toString());
      }
    });
  }

  ngOnDestroy(): void {
    this.speechRecognition!.stop();
  }

  ngAfterViewInit(): void {
    this.colorsCheckBox = this.renderer.selectRootElement('.colors-checkbox input');
    this.keysCheckbox = this.renderer.selectRootElement('.keys-checkbox input');
    this.aiCheckbox = this.renderer.selectRootElement('.ai-checkbox input');
    this.sheet = this.renderer.selectRootElement('#sheet');
    
    this.keysCheckbox.addEventListener('change', () => {
      this.pianoKeys.forEach(key => {
        key.nativeElement.classList.toggle('hide');
      });
    });

    this.colorsCheckBox.addEventListener('change', () => this.showColors = !this.showColors);
  
    this.aiCheckbox.addEventListener('change', () => this.speaker = !this.speaker);

    this.pianoKeys.forEach((key) => {
      this.renderer.listen(key.nativeElement, 'click', () => {
        const octave = this.octave + Number(key.nativeElement.dataset.octave);
        this.playTuneForKeyboard(key.nativeElement.dataset.note, octave.toString());
      });
    });
  
    this.octaveButtons.forEach((button) => {
      this.renderer.listen(button.nativeElement, 'click', () => {
        if (button.nativeElement.dataset.action === '-' && this.octave > 0) {
          this.octave--;
        } else if (button.nativeElement.dataset.action === '+' && this.octave < 5) {
          this.octave++;
        }
      });
    });

    this.scores.forEach((score) => {
      this.renderer.listen(score.nativeElement, 'click', () => {
        this.isScore = true;
        this.renderer.removeClass(this.sheet, 'hidden');
        this.renderScore(score.nativeElement.dataset.score);
        this.renderer.addClass(this.selectScore.nativeElement, 'hidden');
        this.renderer.selectRootElement('.btn-close').click();
      });
    });

    this.osmd = new OpenSheetMusicDisplay('sheet', {drawingParameters: "compacttight", autoResize: true, pageFormat: 'Endless', renderSingleHorizontalStaffline: true});
    if (!this.isScore) {
      this.renderer.addClass(this.sheet, 'hidden');
    }
    
    setTimeout(() => this.speakText('¡Hola, estoy aquí para ayudarte!'), 500);

    this.speechContainer.nativeElement.addEventListener('click', () => {
      if (!this.isRecording) {
        this.isRecording = true;
        this.speechRecognition!.start();
        this.speech.nativeElement.textContent = '';
        this.renderer.removeClass(this.speechContainer.nativeElement, 'contract');
      }
    });

    this.initializeSpeechRecognition();

  }

  playTuneForKeyboard(note: string, octave: string): void {
    this.synth.triggerAttackRelease(note+octave, '8n');
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyElement = this.pianoKeys.find(k => k.nativeElement.dataset.note === note && k.nativeElement.dataset.octave == Number(octave) - this.octave)?.nativeElement;
    if (keyElement) {
      keyElement.classList.add('active');
      const color = this.colorBackground(note);
      if (this.showColors) {
        this.renderer.addClass(this.pianoContainer.nativeElement, color);
      }
      setTimeout(() => {
        keyElement.classList.remove('active');
        this.renderer.removeClass(this.pianoContainer.nativeElement, color);
      }, 150);
    }
    if (this.isScore) {
      const isCorrectNote = this.osmd.cursor.NotesUnderCursor().some(n => notes[n.halfTone % 12] === note);
      if (isCorrectNote) {
        this.osmd.cursor.next();
        const currentNote = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(notes[this.osmd.cursor.NotesUnderCursor()[0]?.halfTone % 12]) + 1;
        this.speakText(currentNote.toString());
      } else {
        const currentNote = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(notes[this.osmd.cursor.NotesUnderCursor()[0]?.halfTone % 12]) + 1;
        this.speakText('¡Inténtalo de nuevo! ' + currentNote);
      }
    } else {
      this.speakText((['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(note) + 1).toString());
    }
  }

  initMIDIAccess(): void {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({ sysex: true })
        .then(this.onMIDISuccess.bind(this), this.onMIDIFailure.bind(this));
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
    const note = message.data[1];
    const velocity = message.data[2];

    if (command === 144) {
      if (velocity > 0) {
        const key = this.midiNumberToNote(note);
        this.playTuneForKeyboard(key[0], key[1]);
      }
    }
  }

  midiNumberToNote(midiNumber: number): string[] {
    const octave = Math.floor(midiNumber / 12) - 1;
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const note = notes[midiNumber % 12];
    return [note, octave.toString()];
  }

  renderScore(score: string) {
    this.speakText('¡Muy buena elección!');
    this.osmd.load('../../assets/scores/' + score,).then(() => {
      this.osmd.render();
      this.osmd.cursor.show();
      const currentNote = this.osmd.cursor.NotesUnderCursor()[0]?.halfTone % 12 + 1;
      setTimeout(() => {this.speakText('¡Vamos a comenzar! ' + currentNote);}, 1500);
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

      this.isRecording = false;
      this.speechRecognition!.stop();

      this.speechSynth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.5;
      utterance.onstart = () => {
        this.renderer.addClass(this.robot.nativeElement, 'robotAnimation');
        this.renderer.addClass(this.chatBubble.nativeElement, 'chatAnimation');
      };
      utterance.onend = () => {
        this.renderer.removeClass(this.robot.nativeElement, 'robotAnimation');
        this.renderer.removeClass(this.chatBubble.nativeElement, 'chatAnimation');
        this.isRecording = true;
        this.speechRecognition!.start();
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
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = false;
      
      this.speechRecognition.onresult = (event) => {
        const lastResult = event.results[event.resultIndex];
        const text = lastResult[0].transcript.trim();
        this.speech.nativeElement.textContent = text;
        this.speechCommand(text.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      };

      this.speechRecognition.onend = () => {
        if (this.isRecording) {
          this.speechRecognition!.start();
        }
      };

      this.speechRecognition.start();
    } else {
      console.warn('Speech recognition not available');
    }
  }

  speechCommand(text: string): void {
    if (text.includes('hola')) {
      this.speakText('¡Hola! ¿En qué puedo ayudarte?');
    } else if (text.includes('adios')) {
      this.speakText('¡Hasta luego!');
      setTimeout(() => {
        this.isRecording = false;
        this.renderer.addClass(this.speechContainer.nativeElement, 'contract');
        this.speechRecognition!.stop();
        this.speech.nativeElement.textContent = '';
      }, 1500);
    } else if (text.includes('repetir')) {
      this.speakText('¡Claro! Repitiendo la última instrucción.');
    } else if (text.includes('teclado') || text.includes('tecla')) {
      this.speakText('¡Claro! Cambiando el estado del teclado.');
      this.keysCheckbox.click();
    } else if (text.includes('colores')) {
      this.speakText(`¡Claro! ${this.showColors ? "Ocultando" : "Mostrando"} los colores.`);
      this.colorsCheckBox.click();
    } else if (text.includes('partitura') || text.includes('melodia')) {
      this.speakText(`¡Claro! Mostrando ocultando las partituras.`);
      this.selectScore.nativeElement.click();
    } else if (text.includes('estrellita')) {
      this.speakText(`¡Claro! Cargando ¿estrellita, dónde estás?`);
      this.scores.get(0)!.nativeElement.click();
    } else if (text.includes('reinicia')) {
      if (this.isScore) {
        this.speakText(`¡Claro! Reiniciando la melodía.`);
        this.osmd.cursor.reset();
      }
    } else if (text.includes('ia') || text.includes('artificial') || text.includes('robot')) {
      if (this.speaker) {
        this.speakText(`¡Claro! Desactivando la asistencia de IA.`);
        this.aiCheckbox.click();
      } else {
        this.aiCheckbox.click();
        this.speakText(`¡Claro! Activando la asistencia de IA.`);
      }
    } else if (text.includes('bajar') || text.includes('baja')) {
      this.speakText(`¡Claro! Bajando una octava.`);
      this.octaveButtons.get(0)!.nativeElement.click();
    } else if (text.includes('subir') || text.includes('sube')) {
      this.speakText(`¡Claro! Subiendo una octava.`);
      this.octaveButtons.get(1)!.nativeElement.click();
    } else if (text.includes('ayuda')) {
      this.speakText('¡Claro! Puedes pedirme que repita, muestre el teclado, los colores o las partituras.');
    }
  }
  
}
