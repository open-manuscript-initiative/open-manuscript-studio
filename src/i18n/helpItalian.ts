import type { HelpCopy } from './help';

export const italianHelp: HelpCopy = {
  navigation: 'Aiuto',
  title: 'Guida di Open Manuscript Studio',
  description: 'Guida completa alle funzioni di modifica, revisione tra pari, pubblicazione, firma ed esportazione attualmente disponibili in Studio 0.1.0-alpha.1.',
  gettingStarted: 'Open Manuscript Studio lavora su un manoscritto semantico: titoli, sezioni, note, citazioni, figure, tabelle, formule, contributori e metadati sono conservati come elementi strutturati e non soltanto come formattazione visiva. Quando un manoscritto viene aperto da OJS, Studio importa tramite l’integrazione il documento e i dati di pubblicazione disponibili per il ruolo e l’assegnazione correnti.',
  topics: [
    {
      title: '1. Modifica del manoscritto e formattazione semantica',
      body: 'Nel redattore principale è possibile modificare il testo e la struttura interna del manoscritto. Studio conserva il significato semantico di paragrafi, titoli e formattazioni inline supportate, in modo che la struttura possa essere trasferita correttamente nei diversi formati di esportazione.',
      tips: ['Per i titoli delle sezioni utilizzare veri livelli di intestazione.', 'Non rappresentare la struttura del documento soltanto con grassetto, corsivo o dimensione del carattere.', 'Quando possibile, preferire elementi semantici alla formattazione diretta.'],
    },
    {
      title: '2. Sezioni, gerarchia e numerazione',
      body: 'Le sezioni del documento formano una gerarchia. Studio gestisce i livelli delle sezioni e la numerazione definita dal profilo di pubblicazione attivo, così la struttura dei capitoli può essere mantenuta anche durante l’esportazione.',
      tips: ['Usare i livelli in modo coerente e collocare le sottosezioni sotto la sezione principale corretta.', 'Quando il profilo lo consente, usare la numerazione strutturale invece di digitare manualmente i numeri delle sezioni.'],
    },
    {
      title: '3. Dati del manoscritto, elementi preliminari e lingue',
      body: 'Nei dati scientifici del manoscritto possono essere gestiti titolo, sottotitolo, motto, abstract, parole chiave, lingua del documento e altri metadati. I campi di pubblicazione multilingui possono essere memorizzati separatamente per ciascuna lingua.',
      tips: ['La lingua principale del manoscritto e la lingua di un singolo metadato sono informazioni distinte.', 'Un manoscritto italiano può contenere, ad esempio, titolo, abstract e parole chiave anche in inglese, tedesco o altre lingue supportate.', 'Il profilo di pubblicazione può rendere determinati metadati obbligatori o raccomandati.'],
    },
    {
      title: '4. Contributori, affiliazioni, ORCID e ROR',
      body: 'La sezione dei contributori permette di gestire autori e altri partecipanti, i loro ruoli, le affiliazioni istituzionali e gli identificatori ORCID. Quando il servizio di ricerca è disponibile, le affiliazioni possono essere arricchite con identificatori ROR.',
      tips: ['Gli identificatori persistenti migliorano l’interoperabilità e la qualità dei metadati esportati.', 'Controllare quali dati dei contributori sono richiesti dal profilo di pubblicazione attivo.'],
    },
    {
      title: '5. Note e citazioni nelle note',
      body: 'Le note a piè di pagina e le note finali sono oggetti semantici separati. Possono contenere testo formattato e citazioni bibliografiche; il loro posizionamento può essere determinato dalle regole del profilo di pubblicazione.',
      tips: ['Non simulare una nota inserendo manualmente numeri in apice.', 'Una fonte citata in una nota può riutilizzare lo stesso record bibliografico già usato nel testo principale.'],
    },
    {
      title: '6. Citazioni, bibliografia e stili di citazione',
      body: 'Le opere citate sono archiviate come record bibliografici strutturati. Lo stesso record può essere riutilizzato in più citazioni nel testo o nelle note. Studio supporta gruppi di citazioni, rendering basato su CSL, una vasta scelta di stili e stili personalizzati salvabili con nome.',
      tips: ['Non creare più record per la stessa opera: riutilizzare quello esistente.', 'Prima dell’esportazione controllare autore, titolo, anno, DOI e altri identificatori.', 'Per esigenze editoriali specifiche creare e salvare uno stile personalizzato anziché modificare manualmente ogni citazione.'],
    },
    {
      title: '7. Riferimenti incrociati',
      body: 'È possibile creare riferimenti interni a sezioni e ad altri oggetti supportati del documento. Poiché il riferimento è collegato all’oggetto di destinazione, la numerazione può essere aggiornata automaticamente quando cambia la struttura del manoscritto.',
      tips: ['Quando possibile usare un riferimento incrociato invece di digitare manualmente espressioni come “vedi Figura 3”.', 'Dopo eliminazioni o riorganizzazioni controllare la diagnostica di pubblicazione per individuare eventuali destinazioni mancanti.'],
    },
    {
      title: '8. Figure, tabelle e formule',
      body: 'Studio tratta gli elementi scientifici visivi come blocchi strutturati. Le figure possono avere un file multimediale, una didascalia, un testo alternativo e una destinazione per i riferimenti; anche la struttura delle tabelle e la rappresentazione semantica delle formule possono essere trasferite nei formati supportati.',
      tips: ['Non costruire tabelle con spazi o tabulazioni.', 'Per le figure usare didascalie informative e, quando possibile, testo alternativo accessibile.', 'Inserire le formule come elementi formula invece che come immagini, salvo esigenze specifiche.'],
    },
    {
      title: '9. File multimediali e pacchetto OMI',
      body: 'Immagini e altri file supportati sono collegati al manoscritto come risorse. Un pacchetto OMI completo può trasportare insieme il manoscritto semantico, i file multimediali associati e i dati necessari alla verifica dell’integrità.',
      tips: ['Usare il pacchetto OMI portabile quando è necessario trasferire anche le risorse multimediali.', 'I dati di integrità aiutano a rilevare file mancanti, danneggiati o modificati.'],
    },
    {
      title: '10. Importazione DOCX',
      body: 'Durante l’importazione di un documento Word, Studio tenta di trasformare intestazioni, formattazioni supportate, note, tabelle e altre strutture riconoscibili in elementi semantici OMI.',
      tips: ['Per i titoli usare gli stili Word Titolo 1, Titolo 2 e così via.', 'Il riconoscimento della sola formattazione diretta è un metodo di ripiego.', 'Dopo l’importazione verificare gerarchia delle sezioni, note, tabelle, formattazione e citazioni.'],
    },
    {
      title: '11. Integrazione con OJS',
      body: 'In una sessione avviata da OJS, Studio può importare il manoscritto e i metadati di pubblicazione disponibili in base agli ambiti di autorizzazione concessi. Lo scambio di dati tra Studio e OJS è sempre collegato al ruolo, all’assegnazione e ai permessi della sessione corrente.',
      tips: ['Possono essere importati soltanto i dati effettivamente presenti in OJS.', 'Se un metadato manca in Studio, controllare prima i dati della pubblicazione in OJS e la relativa variante linguistica.', 'Assicurarsi di aprire il documento con il ruolo e l’assegnazione corretti.'],
    },
    {
      title: '12. Revisione tra pari',
      body: 'Il modello di revisione tra pari di Studio distingue il manoscritto, l’assegnazione del revisore e il lavoro di revisione. Nell’integrazione OJS, l’accesso del revisore è legato all’assegnazione, così vengono resi disponibili soltanto i contenuti e le operazioni consentiti per quel contesto.',
      tips: ['Per la revisione utilizzare sempre la sessione Studio avviata dall’assegnazione pertinente.', 'Nella revisione a doppio cieco evitare di inserire informazioni che possano rivelare inutilmente l’identità dell’autore o del revisore.'],
    },
    {
      title: '13. Revisioni, cronologia e integrità',
      body: 'Studio registra i cambiamenti di stato del manoscritto come revisioni. Le revisioni possono avere un digest crittografico di integrità, mentre gli elementi strutturali eliminati possono restare tracciabili tramite dati tombstone. Questo rende più verificabile la storia del documento.',
      tips: ['Prima di modifiche strutturali importanti creare un punto di revisione chiaramente identificabile.', 'Prima dell’esportazione verificare che lo stato corrente corrisponda alla revisione che si intende pubblicare.'],
    },
    {
      title: '14. Profili di pubblicazione',
      body: 'Il profilo di pubblicazione separa il contenuto scientifico dalle regole editoriali e di presentazione. Può definire formato pagina, margini, tipografia, numerazione di sezioni e oggetti, collocazione delle note, posizione delle didascalie, requisiti dei metadati e formati di uscita supportati.',
      tips: ['Non modificare il contenuto del manoscritto soltanto per imitare l’impaginazione dell’editore: le regole visive appartengono al profilo.', 'Prima dell’esportazione controllare errori e avvisi relativi alla preparazione per la pubblicazione.'],
    },
    {
      title: '15. Profili editoriali personalizzati e protezione',
      body: 'Oltre ai profili incorporati, un editore può creare, denominare, salvare e riutilizzare profili personalizzati con proprie regole e identità visiva, compreso il logo. Un profilo protetto da scrittura non viene modificato direttamente: per nuove regole si crea una nuova versione.',
      tips: ['Creare una nuova versione quando cambiano in modo significativo le norme editoriali.', 'Un profilo può essere associato al manoscritto e riutilizzato in altre installazioni compatibili.', 'La protezione da scrittura preserva una versione editoriale già approvata.'],
    },
    {
      title: '16. CSS di esportazione e CSS di stampa/PDF',
      body: 'Un profilo editoriale personalizzato può contenere un foglio CSS generale per l’esportazione e un foglio CSS separato per stampa/PDF. Il CSS generale controlla la presentazione dell’HTML pubblicato; il livello stampa/PDF viene applicato successivamente e può definire regole @page, margini, interruzioni di pagina e altre impostazioni tipografiche.',
      tips: ['Questi fogli di stile modificano l’output di pubblicazione, non l’interfaccia di modifica di Studio.', 'Il CSS di stampa/PDF viene applicato dopo il CSS generale e può quindi sovrascriverlo.', 'Intestazioni e piè di pagina avanzati dipendono anche dalle funzionalità del motore PDF o del browser utilizzato.'],
    },
    {
      title: '17. Formati di esportazione',
      body: 'La vista Esportazione e strumenti genera diversi formati dallo stesso manoscritto semantico e dal profilo di pubblicazione attivo. Sono attualmente disponibili OMI portabile, OMI JSON, JATS XML, HTML semantico, DOCX, IDML, XTG, MIF, SLA, LaTeX, EPUB e un flusso di stampa in PDF.',
      tips: ['Per archiviazione e ulteriore elaborazione OMI preferire il formato OMI portabile.', 'Per flussi editoriali XML di riviste usare JATS.', 'Il PDF viene attualmente generato attraverso la vista di stampa del browser e l’opzione Salva come PDF.'],
    },
    {
      title: '18. HTML e controllo prima della pubblicazione',
      body: 'L’esportazione HTML semantica produce un documento di pubblicazione senza script. Prima dell’esportazione Studio convalida il manoscritto rispetto al profilo attivo e può segnalare errori o avvisi, ad esempio per metadati obbligatori mancanti, riferimenti interni non risolti o altri problemi editoriali.',
      tips: ['Correggere gli errori bloccanti prima dell’esportazione.', 'Gli avvisi non impediscono necessariamente l’esportazione, ma devono essere verificati singolarmente.'],
    },
    {
      title: '19. Firma crittografica dell’autore',
      body: 'Gli autori registrati possono firmare crittograficamente una specifica revisione del manoscritto mediante una credenziale sicura WebAuthn/passkey collegata a un’identità verificata, ad esempio ORCID. La firma è associata al digest della revisione: se il manoscritto cambia, la firma precedente resta valida per la vecchia revisione ma non certifica automaticamente quella nuova.',
      tips: ['L’ORCID inserito manualmente nei metadati non equivale a un’identità ORCID autenticata.', 'Ogni coautore può firmare separatamente la stessa revisione.', 'Le firme si gestiscono dalla voce dedicata “Firme” del menu e non devono restare permanentemente aperte accanto al documento.'],
    },
    {
      title: '20. Archiviazione e risoluzione dei problemi',
      body: 'Studio supporta flussi di archiviazione locali e, quando configurati, sistemi esterni come WebDAV/Nextcloud. Se qualcosa non appare correttamente, occorre distinguere tra problemi di contenuto, struttura, metadati, integrazione, profilo editoriale o presentazione dell’output.',
      tips: ['Per DOCX controllare gli stili di intestazione Word e la struttura di note e tabelle.', 'Per OJS controllare metadati della pubblicazione, assegnazione e contesto dei permessi.', 'Per HTML/PDF controllare il profilo attivo, il CSS di esportazione e il CSS di stampa/PDF.', 'Per migrazione o backup creare un pacchetto OMI portabile.'],
    },
  ],
};
