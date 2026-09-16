import type { HelpCopy, HelpTopic } from './help';

const musicImportTopic: Partial<Record<string, HelpTopic>> = {
  hu: {
    title: 'MusicXML és MIDI import',
    body: 'A Stúdió MusicXML (.musicxml, .xml) és MIDI (.mid, .midi) fájlokból kottablokkot tud létrehozni. A MusicXML-import strukturált kottaadatokat olvas be, többek között a címet, az elérhető szerzői/zeneszerzői adatot, az ütemmutatót, a hangmagasságot, az alterációt, az oktávot, az időtartamot, a hangjegytípust és a szüneteket. A MIDI-import elsősorban a hangmagasság-alapú hangjegyeseményeket veszi át, ezért nem őrzi meg a kottakép teljes szemantikáját és tipográfiáját.',
    tips: [
      'Szerkeszthető, strukturált kotta átviteléhez lehetőség szerint MusicXML-t használjon; a MIDI inkább hangmagasság-adatok átvitelére alkalmas.',
      'A MusicXML és a MIDI import külön-külön kikapcsolható a Beállítások importformátumai között.',
      'Import után ellenőrizze a hangokat, az ütemmutatót és a zenei szerkezetet, mert az eredeti kottázóprogram egyes speciális elemei nem feltétlenül vihetők át.',
    ],
  },
  en: {
    title: 'MusicXML and MIDI import',
    body: 'Studio can create a music-score block from MusicXML (.musicxml, .xml) and MIDI (.mid, .midi) files. MusicXML import reads structured notation data including the title, available creator/composer information, time signature, pitch, accidentals, octave, duration, note type, and rests. MIDI import primarily transfers pitch-based note events, so it does not preserve the full semantics or typography of the original score.',
    tips: [
      'Use MusicXML whenever possible for editable, structured notation; MIDI is better suited to transferring pitch data.',
      'MusicXML and MIDI import can be disabled independently in Settings under the import-format options.',
      'After import, verify the notes, time signature, and musical structure because some application-specific notation features may not be transferable.',
    ],
  },
  de: {
    title: 'MusicXML- und MIDI-Import',
    body: 'Studio kann aus MusicXML-Dateien (.musicxml, .xml) und MIDI-Dateien (.mid, .midi) einen Notensatzblock erzeugen. Der MusicXML-Import liest strukturierte Notationsdaten ein, darunter Titel, verfügbare Angaben zu Urheber oder Komponist, Taktart, Tonhöhe, Vorzeichen, Oktave, Dauer, Notentyp und Pausen. Der MIDI-Import übernimmt vor allem tonhöhenbezogene Notenereignisse und bewahrt daher weder die vollständige Semantik noch die Typografie des ursprünglichen Notenbildes.',
    tips: [
      'Verwenden Sie für bearbeitbare, strukturierte Notation nach Möglichkeit MusicXML; MIDI eignet sich eher zur Übernahme von Tonhöhendaten.',
      'MusicXML- und MIDI-Import können in den Einstellungen bei den Importformaten unabhängig voneinander deaktiviert werden.',
      'Prüfen Sie nach dem Import Noten, Taktart und musikalische Struktur, da anwendungsspezifische Notationselemente nicht immer übertragen werden können.',
    ],
  },
};

export function appendMusicImportHelp(locale: string, copy: HelpCopy): HelpCopy {
  const topic = musicImportTopic[locale];
  if (!topic || copy.topics.some((existing) => existing.title === topic.title)) return copy;
  return { ...copy, topics: [...copy.topics, topic] };
}
