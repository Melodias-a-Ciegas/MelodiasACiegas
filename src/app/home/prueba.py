import music21

def analizar_archivo_mxl(filename):
    # Cargar el archivo MXL (MusicXML comprimido)
    try:
        score = music21.converter.parse(filename)
    except Exception as e:
        print("Error al leer el archivo:", e)
        return
    
    # 1. Número total de notas
    numero_total_notas = len(score.flatten().getElementsByClass(music21.note.Note))
    
    # 2. Duración total y densidad de notas
    duracion_total = score.highestTime  # en beats
    densidad_notas = numero_total_notas / duracion_total if duracion_total > 0 else 0
    
    # 3. Cantidad de saltos grandes entre notas
    notas = list(score.flatten().getElementsByClass(music21.note.Note))
    cantidad_saltos_grandes = 0
    if notas:
        nota_previa = notas[0]
        for nota in notas[1:]:
            intervalo = music21.interval.Interval(nota_previa, nota)
            if abs(intervalo.semitones) > 12:  # Saltos mayores a una octava
                cantidad_saltos_grandes += 1
            nota_previa = nota
    
    # 4. Notas por mano izquierda y derecha
    parts = score.parts
    if len(parts) >= 2:
        mano_izquierda = parts[0].flatten()
        mano_derecha = parts[1].flatten()
    else:
        mano_izquierda = mano_derecha = parts[0].flatten()
    
    notas_mano_izquierda = len(mano_izquierda.getElementsByClass(music21.note.Note))
    notas_mano_derecha = len(mano_derecha.getElementsByClass(music21.note.Note))
    
    # 5. Presencia de tuplets
    tuplets = 0
    for n in score.flatten().getElementsByClass(music21.note.Note):
        if n.duration.tuplets:
            tuplets += len(n.duration.tuplets)
    
    # Resultados
    resultados = {
        "numero_total_notas": numero_total_notas,
        "densidad_notas": densidad_notas,
        "cantidad_saltos_grandes": cantidad_saltos_grandes,
        "notas_mano_izquierda": notas_mano_izquierda,
        "notas_mano_derecha": notas_mano_derecha,
        "tuplets": tuplets
    }
    
    return resultados

if __name__ == '__main__':
    archivo = r"C:\Users\Elkur\Proyectos\Canciones_piano\12_Variations_of_Twinkle_Twinkle_Little_Star.mxl"
    resultados = analizar_archivo_mxl(archivo)
    if resultados:
        print("=== RESULTADOS ===")
        for key, value in resultados.items():
            print(f"{key}: {value}")