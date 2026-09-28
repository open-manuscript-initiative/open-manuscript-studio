export interface CollaborationPanelCopy {
  title: string;
  connected: string;
  connecting: string;
  inviteAuthor: string;
  emailAddress: string;
  sendInvitation: string;
  cancel: string;
  awaitingAcceptance: string;
  invitationSent: string;
  invitationEmailFailed: string;
}

interface CollaborationPanelActionCopy {
  startSharedEditing: string;
  starting: string;
}

const english: CollaborationPanelCopy = {
  title: 'Live collaboration',
  connected: 'Connected',
  connecting: 'Connecting',
  inviteAuthor: 'Invite an author',
  emailAddress: 'Email address',
  sendInvitation: 'Send invitation',
  cancel: 'Cancel',
  awaitingAcceptance: 'awaiting acceptance',
  invitationSent: 'Invitation sent. The invited author must accept it before joining.',
  invitationEmailFailed: 'Invitation added to the Studio inbox, but the notification email could not be sent.',
};

const copyByLocale: Record<string, CollaborationPanelCopy> = {
  af: { title: 'Regstreekse samewerking', connected: 'Gekoppel', connecting: 'Koppel tans', inviteAuthor: 'Nooi ’n outeur uit', emailAddress: 'E-posadres', sendInvitation: 'Stuur uitnodiging', cancel: 'Kanselleer', awaitingAcceptance: 'wag op aanvaarding', invitationSent: 'Uitnodiging gestuur. Die genooide outeur moet dit aanvaar voordat hulle kan aansluit.', invitationEmailFailed: 'Uitnodiging by die Studio-inkassie gevoeg, maar die kennisgewing-e-pos kon nie gestuur word nie.' },
  am: { title: 'ቀጥታ ትብብር', connected: 'ተገናኝቷል', connecting: 'በመገናኘት ላይ', inviteAuthor: 'ደራሲ ይጋብዙ', emailAddress: 'የኢሜይል አድራሻ', sendInvitation: 'ግብዣ ላክ', cancel: 'ይቅር', awaitingAcceptance: 'መቀበልን በመጠባበቅ ላይ', invitationSent: 'ግብዣው ተልኳል። የተጋበዘው ደራሲ ከመቀላቀሉ በፊት መቀበል አለበት።', invitationEmailFailed: 'ግብዣው ወደ Studio የገቢ መልዕክት ሳጥን ታክሏል፣ ግን የማሳወቂያ ኢሜይሉ ሊላክ አልቻለም።' },
  bg: { title: 'Съвместна работа на живо', connected: 'Свързано', connecting: 'Свързване', inviteAuthor: 'Поканете автор', emailAddress: 'Имейл адрес', sendInvitation: 'Изпрати покана', cancel: 'Отказ', awaitingAcceptance: 'в очакване на приемане', invitationSent: 'Поканата е изпратена. Поканеният автор трябва да я приеме, преди да се присъедини.', invitationEmailFailed: 'Поканата е добавена във входящата кутия на Studio, но имейлът за известие не можа да бъде изпратен.' },
  ca: { title: 'Col·laboració en directe', connected: 'Connectat', connecting: 'Connectant', inviteAuthor: 'Convida un autor', emailAddress: 'Adreça electrònica', sendInvitation: 'Envia la invitació', cancel: 'Cancel·la', awaitingAcceptance: 'pendent d’acceptació', invitationSent: 'S’ha enviat la invitació. L’autor convidat l’ha d’acceptar abans d’unir-se.', invitationEmailFailed: 'La invitació s’ha afegit a la safata d’entrada de Studio, però no s’ha pogut enviar el correu de notificació.' },
  cs: { title: 'Živá spolupráce', connected: 'Připojeno', connecting: 'Připojování', inviteAuthor: 'Pozvat autora', emailAddress: 'E-mailová adresa', sendInvitation: 'Odeslat pozvánku', cancel: 'Zrušit', awaitingAcceptance: 'čeká na přijetí', invitationSent: 'Pozvánka byla odeslána. Pozvaný autor ji musí před připojením přijmout.', invitationEmailFailed: 'Pozvánka byla přidána do schránky Studio, ale oznamovací e-mail se nepodařilo odeslat.' },
  da: { title: 'Live samarbejde', connected: 'Forbundet', connecting: 'Opretter forbindelse', inviteAuthor: 'Invitér en forfatter', emailAddress: 'E-mailadresse', sendInvitation: 'Send invitation', cancel: 'Annuller', awaitingAcceptance: 'afventer accept', invitationSent: 'Invitationen er sendt. Den inviterede forfatter skal acceptere den, før vedkommende kan deltage.', invitationEmailFailed: 'Invitationen blev føjet til Studio-indbakken, men notifikationsmailen kunne ikke sendes.' },
  de: { title: 'Live-Zusammenarbeit', connected: 'Verbunden', connecting: 'Verbindung wird hergestellt', inviteAuthor: 'Autorin oder Autor einladen', emailAddress: 'E-Mail-Adresse', sendInvitation: 'Einladung senden', cancel: 'Abbrechen', awaitingAcceptance: 'Annahme ausstehend', invitationSent: 'Einladung gesendet. Die eingeladene Person muss sie annehmen, bevor sie mitarbeiten kann.', invitationEmailFailed: 'Die Einladung wurde dem Studio-Postfach hinzugefügt, aber die Benachrichtigungs-E-Mail konnte nicht gesendet werden.' },
  el: { title: 'Ζωντανή συνεργασία', connected: 'Συνδέθηκε', connecting: 'Σύνδεση…', inviteAuthor: 'Πρόσκληση συγγραφέα', emailAddress: 'Διεύθυνση email', sendInvitation: 'Αποστολή πρόσκλησης', cancel: 'Ακύρωση', awaitingAcceptance: 'σε αναμονή αποδοχής', invitationSent: 'Η πρόσκληση στάλθηκε. Ο προσκεκλημένος συγγραφέας πρέπει να την αποδεχτεί πριν συμμετάσχει.', invitationEmailFailed: 'Η πρόσκληση προστέθηκε στα εισερχόμενα του Studio, αλλά δεν ήταν δυνατή η αποστολή του email ειδοποίησης.' },
  en: english,
  es: { title: 'Colaboración en directo', connected: 'Conectado', connecting: 'Conectando', inviteAuthor: 'Invitar a un autor', emailAddress: 'Correo electrónico', sendInvitation: 'Enviar invitación', cancel: 'Cancelar', awaitingAcceptance: 'pendiente de aceptación', invitationSent: 'Invitación enviada. El autor invitado debe aceptarla antes de unirse.', invitationEmailFailed: 'La invitación se añadió a la bandeja de Studio, pero no se pudo enviar el correo de notificación.' },
  et: { title: 'Reaalajas koostöö', connected: 'Ühendatud', connecting: 'Ühendamine', inviteAuthor: 'Kutsu autor', emailAddress: 'E-posti aadress', sendInvitation: 'Saada kutse', cancel: 'Tühista', awaitingAcceptance: 'ootab vastuvõtmist', invitationSent: 'Kutse on saadetud. Kutsutud autor peab enne liitumist kutse vastu võtma.', invitationEmailFailed: 'Kutse lisati Studio postkasti, kuid teavituskirja ei saanud saata.' },
  fi: { title: 'Reaaliaikainen yhteistyö', connected: 'Yhdistetty', connecting: 'Yhdistetään', inviteAuthor: 'Kutsu kirjoittaja', emailAddress: 'Sähköpostiosoite', sendInvitation: 'Lähetä kutsu', cancel: 'Peruuta', awaitingAcceptance: 'odottaa hyväksyntää', invitationSent: 'Kutsu lähetetty. Kutsutun kirjoittajan on hyväksyttävä se ennen liittymistä.', invitationEmailFailed: 'Kutsu lisättiin Studion saapuneisiin, mutta ilmoitussähköpostia ei voitu lähettää.' },
  fil: { title: 'Live na pakikipagtulungan', connected: 'Nakakonekta', connecting: 'Kumokonekta', inviteAuthor: 'Mag-imbita ng may-akda', emailAddress: 'Email address', sendInvitation: 'Ipadala ang imbitasyon', cancel: 'Kanselahin', awaitingAcceptance: 'naghihintay ng pagtanggap', invitationSent: 'Naipadala ang imbitasyon. Dapat itong tanggapin ng inimbitahang may-akda bago sumali.', invitationEmailFailed: 'Idinagdag ang imbitasyon sa inbox ng Studio, ngunit hindi naipadala ang email ng abiso.' },
  fr: { title: 'Collaboration en direct', connected: 'Connecté', connecting: 'Connexion en cours', inviteAuthor: 'Inviter un auteur', emailAddress: 'Adresse e-mail', sendInvitation: 'Envoyer l’invitation', cancel: 'Annuler', awaitingAcceptance: 'en attente d’acceptation', invitationSent: 'Invitation envoyée. L’auteur invité doit l’accepter avant de rejoindre le document.', invitationEmailFailed: 'L’invitation a été ajoutée à la boîte de réception de Studio, mais l’e-mail de notification n’a pas pu être envoyé.' },
  ga: { title: 'Comhoibriú beo', connected: 'Ceangailte', connecting: 'Ag nascadh', inviteAuthor: 'Tabhair cuireadh d’údar', emailAddress: 'Seoladh ríomhphoist', sendInvitation: 'Seol cuireadh', cancel: 'Cealaigh', awaitingAcceptance: 'ag fanacht le glacadh', invitationSent: 'Seoladh an cuireadh. Ní mór don údar cuireadh a ghlacadh leis sula nglacfaidh sé páirt.', invitationEmailFailed: 'Cuireadh an cuireadh le bosca isteach Studio, ach níorbh fhéidir an ríomhphost fógra a sheoladh.' },
  he: { title: 'שיתוף פעולה בזמן אמת', connected: 'מחובר', connecting: 'מתחבר', inviteAuthor: 'הזמנת מחבר/ת', emailAddress: 'כתובת אימייל', sendInvitation: 'שליחת הזמנה', cancel: 'ביטול', awaitingAcceptance: 'ממתין לאישור', invitationSent: 'ההזמנה נשלחה. המחבר/ת שהוזמן/ה צריך/ה לאשר אותה לפני ההצטרפות.', invitationEmailFailed: 'ההזמנה נוספה לתיבת הדואר הנכנס של Studio, אך לא ניתן היה לשלוח את הודעת האימייל.' },
  hi: { title: 'लाइव सहयोग', connected: 'कनेक्ट हो गया', connecting: 'कनेक्ट हो रहा है', inviteAuthor: 'लेखक को आमंत्रित करें', emailAddress: 'ईमेल पता', sendInvitation: 'निमंत्रण भेजें', cancel: 'रद्द करें', awaitingAcceptance: 'स्वीकृति की प्रतीक्षा में', invitationSent: 'निमंत्रण भेज दिया गया है। शामिल होने से पहले आमंत्रित लेखक को इसे स्वीकार करना होगा।', invitationEmailFailed: 'निमंत्रण Studio इनबॉक्स में जोड़ दिया गया, लेकिन सूचना ईमेल नहीं भेजा जा सका।' },
  hr: { title: 'Suradnja uživo', connected: 'Povezano', connecting: 'Povezivanje', inviteAuthor: 'Pozovi autora', emailAddress: 'Adresa e-pošte', sendInvitation: 'Pošalji pozivnicu', cancel: 'Odustani', awaitingAcceptance: 'čeka prihvaćanje', invitationSent: 'Pozivnica je poslana. Pozvani autor mora je prihvatiti prije pridruživanja.', invitationEmailFailed: 'Pozivnica je dodana u Studio ulaznu poštu, ali e-poruku s obavijesti nije bilo moguće poslati.' },
  hu: { title: 'Élő együttműködés', connected: 'Kapcsolódva', connecting: 'Kapcsolódás folyamatban', inviteAuthor: 'Szerző meghívása', emailAddress: 'E-mail-cím', sendInvitation: 'Meghívás küldése', cancel: 'Mégsem', awaitingAcceptance: 'elfogadásra vár', invitationSent: 'A meghívást elküldtük. A meghívott szerzőnek csatlakozás előtt el kell fogadnia.', invitationEmailFailed: 'A meghívás bekerült a Stúdió postaládájába, de az értesítő e-mailt nem sikerült elküldeni.' },
  id: { title: 'Kolaborasi langsung', connected: 'Terhubung', connecting: 'Menghubungkan', inviteAuthor: 'Undang penulis', emailAddress: 'Alamat email', sendInvitation: 'Kirim undangan', cancel: 'Batal', awaitingAcceptance: 'menunggu penerimaan', invitationSent: 'Undangan terkirim. Penulis yang diundang harus menerimanya sebelum bergabung.', invitationEmailFailed: 'Undangan ditambahkan ke kotak masuk Studio, tetapi email pemberitahuan tidak dapat dikirim.' },
  is: { title: 'Samvinna í beinni', connected: 'Tengt', connecting: 'Tengist', inviteAuthor: 'Bjóða höfundi', emailAddress: 'Netfang', sendInvitation: 'Senda boð', cancel: 'Hætta við', awaitingAcceptance: 'bíður samþykkis', invitationSent: 'Boðið hefur verið sent. Boðinn höfundur þarf að samþykkja áður en hann tengist.', invitationEmailFailed: 'Boðinu var bætt við innhólf Studio en ekki tókst að senda tilkynningarpóst.' },
  it: { title: 'Collaborazione in tempo reale', connected: 'Connesso', connecting: 'Connessione in corso', inviteAuthor: 'Invita un autore', emailAddress: 'Indirizzo e-mail', sendInvitation: 'Invia invito', cancel: 'Annulla', awaitingAcceptance: 'in attesa di accettazione', invitationSent: 'Invito inviato. L’autore invitato deve accettarlo prima di partecipare.', invitationEmailFailed: 'L’invito è stato aggiunto alla posta in arrivo di Studio, ma non è stato possibile inviare l’e-mail di notifica.' },
  ja: { title: 'リアルタイム共同作業', connected: '接続済み', connecting: '接続中', inviteAuthor: '著者を招待', emailAddress: 'メールアドレス', sendInvitation: '招待を送信', cancel: 'キャンセル', awaitingAcceptance: '承諾待ち', invitationSent: '招待を送信しました。参加するには招待された著者の承諾が必要です。', invitationEmailFailed: '招待はStudioの受信箱に追加されましたが、通知メールを送信できませんでした。' },
  ko: { title: '실시간 공동 작업', connected: '연결됨', connecting: '연결 중', inviteAuthor: '저자 초대', emailAddress: '이메일 주소', sendInvitation: '초대 보내기', cancel: '취소', awaitingAcceptance: '수락 대기 중', invitationSent: '초대를 보냈습니다. 초대받은 저자는 참여하기 전에 초대를 수락해야 합니다.', invitationEmailFailed: '초대가 Studio 받은 편지함에 추가되었지만 알림 이메일을 보낼 수 없습니다.' },
  lt: { title: 'Tiesioginis bendradarbiavimas', connected: 'Prisijungta', connecting: 'Jungiamasi', inviteAuthor: 'Pakviesti autorių', emailAddress: 'El. pašto adresas', sendInvitation: 'Siųsti kvietimą', cancel: 'Atšaukti', awaitingAcceptance: 'laukiama patvirtinimo', invitationSent: 'Kvietimas išsiųstas. Pakviestas autorius turi jį priimti prieš prisijungdamas.', invitationEmailFailed: 'Kvietimas įtrauktas į Studio gautuosius, tačiau pranešimo el. laiško išsiųsti nepavyko.' },
  lv: { title: 'Tiešsaistes sadarbība', connected: 'Savienots', connecting: 'Veido savienojumu', inviteAuthor: 'Uzaicināt autoru', emailAddress: 'E-pasta adrese', sendInvitation: 'Sūtīt uzaicinājumu', cancel: 'Atcelt', awaitingAcceptance: 'gaida apstiprinājumu', invitationSent: 'Uzaicinājums nosūtīts. Uzaicinātajam autoram tas jāpieņem, pirms viņš var pievienoties.', invitationEmailFailed: 'Uzaicinājums pievienots Studio iesūtnei, taču paziņojuma e-pastu neizdevās nosūtīt.' },
  ms: { title: 'Kerjasama langsung', connected: 'Bersambung', connecting: 'Menyambung', inviteAuthor: 'Jemput pengarang', emailAddress: 'Alamat e-mel', sendInvitation: 'Hantar jemputan', cancel: 'Batal', awaitingAcceptance: 'menunggu penerimaan', invitationSent: 'Jemputan dihantar. Pengarang yang dijemput mesti menerimanya sebelum menyertai.', invitationEmailFailed: 'Jemputan ditambahkan ke peti masuk Studio, tetapi e-mel pemberitahuan tidak dapat dihantar.' },
  mt: { title: 'Kollaborazzjoni diretta', connected: 'Imqabbad', connecting: 'Qed jitqabbad', inviteAuthor: 'Stieden awtur', emailAddress: 'Indirizz tal-email', sendInvitation: 'Ibgħat stedina', cancel: 'Ikkanċella', awaitingAcceptance: 'qed tistenna l-aċċettazzjoni', invitationSent: 'L-istedina ntbagħtet. L-awtur mistieden irid jaċċettaha qabel jingħaqad.', invitationEmailFailed: 'L-istedina żdiedet fil-kaxxa tal-inbox ta’ Studio, iżda l-email ta’ notifika ma setgħetx tintbagħat.' },
  nl: { title: 'Live samenwerking', connected: 'Verbonden', connecting: 'Verbinding maken', inviteAuthor: 'Een auteur uitnodigen', emailAddress: 'E-mailadres', sendInvitation: 'Uitnodiging verzenden', cancel: 'Annuleren', awaitingAcceptance: 'wacht op acceptatie', invitationSent: 'Uitnodiging verzonden. De uitgenodigde auteur moet deze accepteren voordat die kan deelnemen.', invitationEmailFailed: 'De uitnodiging is aan de Studio-inbox toegevoegd, maar de meldingsmail kon niet worden verzonden.' },
  no: { title: 'Samarbeid i sanntid', connected: 'Tilkoblet', connecting: 'Kobler til', inviteAuthor: 'Inviter en forfatter', emailAddress: 'E-postadresse', sendInvitation: 'Send invitasjon', cancel: 'Avbryt', awaitingAcceptance: 'venter på godkjenning', invitationSent: 'Invitasjonen er sendt. Den inviterte forfatteren må godta den før vedkommende kan bli med.', invitationEmailFailed: 'Invitasjonen ble lagt til i Studio-innboksen, men varslings-e-posten kunne ikke sendes.' },
  pl: { title: 'Współpraca na żywo', connected: 'Połączono', connecting: 'Łączenie', inviteAuthor: 'Zaproś autora', emailAddress: 'Adres e-mail', sendInvitation: 'Wyślij zaproszenie', cancel: 'Anuluj', awaitingAcceptance: 'oczekuje na akceptację', invitationSent: 'Zaproszenie wysłano. Zaproszony autor musi je zaakceptować, zanim dołączy.', invitationEmailFailed: 'Zaproszenie dodano do skrzynki Studio, ale nie udało się wysłać wiadomości z powiadomieniem.' },
  pt: { title: 'Colaboração ao vivo', connected: 'Ligado', connecting: 'A ligar', inviteAuthor: 'Convidar um autor', emailAddress: 'Endereço de e-mail', sendInvitation: 'Enviar convite', cancel: 'Cancelar', awaitingAcceptance: 'a aguardar aceitação', invitationSent: 'Convite enviado. O autor convidado tem de o aceitar antes de participar.', invitationEmailFailed: 'O convite foi adicionado à caixa de entrada do Studio, mas não foi possível enviar o e-mail de notificação.' },
  ro: { title: 'Colaborare în timp real', connected: 'Conectat', connecting: 'Se conectează', inviteAuthor: 'Invită un autor', emailAddress: 'Adresă de e-mail', sendInvitation: 'Trimite invitația', cancel: 'Anulează', awaitingAcceptance: 'în așteptarea acceptării', invitationSent: 'Invitația a fost trimisă. Autorul invitat trebuie să o accepte înainte de a se alătura.', invitationEmailFailed: 'Invitația a fost adăugată în căsuța Studio, dar e-mailul de notificare nu a putut fi trimis.' },
  ru: { title: 'Совместная работа в реальном времени', connected: 'Подключено', connecting: 'Подключение', inviteAuthor: 'Пригласить автора', emailAddress: 'Адрес эл. почты', sendInvitation: 'Отправить приглашение', cancel: 'Отмена', awaitingAcceptance: 'ожидает принятия', invitationSent: 'Приглашение отправлено. Приглашённый автор должен принять его, прежде чем присоединиться.', invitationEmailFailed: 'Приглашение добавлено во входящие Studio, но письмо с уведомлением не удалось отправить.' },
  sk: { title: 'Živá spolupráca', connected: 'Pripojené', connecting: 'Pripájanie', inviteAuthor: 'Pozvať autora', emailAddress: 'E-mailová adresa', sendInvitation: 'Odoslať pozvánku', cancel: 'Zrušiť', awaitingAcceptance: 'čaká na prijatie', invitationSent: 'Pozvánka bola odoslaná. Pozvaný autor ju musí pred pripojením prijať.', invitationEmailFailed: 'Pozvánka bola pridaná do schránky Studio, ale upozorňovací e-mail sa nepodarilo odoslať.' },
  sl: { title: 'Sodelovanje v živo', connected: 'Povezano', connecting: 'Povezovanje', inviteAuthor: 'Povabi avtorja', emailAddress: 'E-poštni naslov', sendInvitation: 'Pošlji povabilo', cancel: 'Prekliči', awaitingAcceptance: 'čaka na sprejem', invitationSent: 'Povabilo je poslano. Povabljeni avtor ga mora sprejeti, preden se pridruži.', invitationEmailFailed: 'Povabilo je bilo dodano v mapo »Prejeto« v Studiu, vendar e-poštnega obvestila ni bilo mogoče poslati.' },
  sr: { title: 'Сарадња уживо', connected: 'Повезано', connecting: 'Повезивање', inviteAuthor: 'Позови аутора', emailAddress: 'Имејл адреса', sendInvitation: 'Пошаљи позив', cancel: 'Откажи', awaitingAcceptance: 'чека на прихватање', invitationSent: 'Позив је послат. Позвани аутор мора да га прихвати пре него што се придружи.', invitationEmailFailed: 'Позив је додат у Studio пријемно сандуче, али имејл обавештења није могао да се пошаље.' },
  sv: { title: 'Samarbete i realtid', connected: 'Ansluten', connecting: 'Ansluter', inviteAuthor: 'Bjud in en författare', emailAddress: 'E-postadress', sendInvitation: 'Skicka inbjudan', cancel: 'Avbryt', awaitingAcceptance: 'väntar på godkännande', invitationSent: 'Inbjudan har skickats. Den inbjudna författaren måste godkänna den innan hen kan delta.', invitationEmailFailed: 'Inbjudan lades till i Studio-inkorgen, men aviseringen kunde inte skickas via e-post.' },
  sw: { title: 'Ushirikiano wa moja kwa moja', connected: 'Imeunganishwa', connecting: 'Inaunganisha', inviteAuthor: 'Alika mwandishi', emailAddress: 'Anwani ya barua pepe', sendInvitation: 'Tuma mwaliko', cancel: 'Ghairi', awaitingAcceptance: 'inasubiri kukubaliwa', invitationSent: 'Mwaliko umetumwa. Mwandishi aliyealikwa lazima aukubali kabla ya kujiunga.', invitationEmailFailed: 'Mwaliko umeongezwa kwenye kikasha cha Studio, lakini barua pepe ya taarifa haikuweza kutumwa.' },
  th: { title: 'ทำงานร่วมกันแบบเรียลไทม์', connected: 'เชื่อมต่อแล้ว', connecting: 'กำลังเชื่อมต่อ', inviteAuthor: 'เชิญผู้เขียน', emailAddress: 'ที่อยู่อีเมล', sendInvitation: 'ส่งคำเชิญ', cancel: 'ยกเลิก', awaitingAcceptance: 'กำลังรอการตอบรับ', invitationSent: 'ส่งคำเชิญแล้ว ผู้เขียนที่ได้รับเชิญต้องยอมรับก่อนจึงจะเข้าร่วมได้', invitationEmailFailed: 'เพิ่มคำเชิญในกล่องจดหมาย Studio แล้ว แต่ไม่สามารถส่งอีเมลแจ้งเตือนได้' },
  tr: { title: 'Canlı iş birliği', connected: 'Bağlandı', connecting: 'Bağlanıyor', inviteAuthor: 'Yazar davet et', emailAddress: 'E-posta adresi', sendInvitation: 'Daveti gönder', cancel: 'İptal', awaitingAcceptance: 'kabul bekleniyor', invitationSent: 'Davet gönderildi. Davet edilen yazar katılmadan önce daveti kabul etmelidir.', invitationEmailFailed: 'Davet Studio gelen kutusuna eklendi, ancak bildirim e-postası gönderilemedi.' },
  uk: { title: 'Спільна робота наживо', connected: 'Підключено', connecting: 'Підключення', inviteAuthor: 'Запросити автора', emailAddress: 'Електронна адреса', sendInvitation: 'Надіслати запрошення', cancel: 'Скасувати', awaitingAcceptance: 'очікує на прийняття', invitationSent: 'Запрошення надіслано. Запрошений автор має прийняти його, перш ніж приєднатися.', invitationEmailFailed: 'Запрошення додано до вхідних Studio, але не вдалося надіслати сповіщення електронною поштою.' },
  vi: { title: 'Cộng tác trực tiếp', connected: 'Đã kết nối', connecting: 'Đang kết nối', inviteAuthor: 'Mời tác giả', emailAddress: 'Địa chỉ email', sendInvitation: 'Gửi lời mời', cancel: 'Hủy', awaitingAcceptance: 'đang chờ chấp nhận', invitationSent: 'Đã gửi lời mời. Tác giả được mời cần chấp nhận trước khi tham gia.', invitationEmailFailed: 'Lời mời đã được thêm vào hộp thư Studio nhưng không thể gửi email thông báo.' },
  'zh-CN': { title: '实时协作', connected: '已连接', connecting: '正在连接', inviteAuthor: '邀请作者', emailAddress: '电子邮件地址', sendInvitation: '发送邀请', cancel: '取消', awaitingAcceptance: '等待接受', invitationSent: '邀请已发送。受邀作者必须先接受邀请才能加入。', invitationEmailFailed: '邀请已添加到 Studio 收件箱，但无法发送通知邮件。' },
  'zh-HK': { title: '即時協作', connected: '已連線', connecting: '正在連線', inviteAuthor: '邀請作者', emailAddress: '電郵地址', sendInvitation: '傳送邀請', cancel: '取消', awaitingAcceptance: '等待接受', invitationSent: '邀請已傳送。受邀作者必須先接受邀請才能加入。', invitationEmailFailed: '邀請已加入 Studio 收件箱，但無法傳送通知電郵。' },
  'zh-TW': { title: '即時協作', connected: '已連線', connecting: '正在連線', inviteAuthor: '邀請作者', emailAddress: '電子郵件地址', sendInvitation: '傳送邀請', cancel: '取消', awaitingAcceptance: '等待接受', invitationSent: '邀請已傳送。受邀作者必須先接受邀請才能加入。', invitationEmailFailed: '邀請已加入 Studio 收件匣，但無法傳送通知電子郵件。' },
  zu: { title: 'Ukusebenzisana bukhoma', connected: 'Kuxhunyiwe', connecting: 'Kuyaxhuma', inviteAuthor: 'Mema umbhali', emailAddress: 'Ikheli le-imeyili', sendInvitation: 'Thumela isimemo', cancel: 'Khansela', awaitingAcceptance: 'kulindwe ukwamukelwa', invitationSent: 'Isimemo sithunyelwe. Umbhali omenyiwe kufanele asamukele ngaphambi kokujoyina.', invitationEmailFailed: 'Isimemo sifakwe ebhokisini lokungenayo le-Studio, kodwa i-imeyili yesaziso ayikwazanga ukuthunyelwa.' },
};

const actionCopyByLocale: Record<string, CollaborationPanelActionCopy> = {
  af: { startSharedEditing: 'Begin gedeelde redigering', starting: 'Begin tans…' },
  am: { startSharedEditing: 'የጋራ አርትዖትን ጀምር', starting: 'በመጀመር ላይ…' },
  bg: { startSharedEditing: 'Стартиране на съвместна редакция', starting: 'Стартиране…' },
  ca: { startSharedEditing: 'Inicia l’edició compartida', starting: 'S’està iniciant…' },
  cs: { startSharedEditing: 'Zahájit sdílené úpravy', starting: 'Spouštění…' },
  da: { startSharedEditing: 'Start fælles redigering', starting: 'Starter…' },
  de: { startSharedEditing: 'Gemeinsame Bearbeitung starten', starting: 'Wird gestartet…' },
  el: { startSharedEditing: 'Έναρξη κοινής επεξεργασίας', starting: 'Εκκίνηση…' },
  es: { startSharedEditing: 'Iniciar edición compartida', starting: 'Iniciando…' },
  et: { startSharedEditing: 'Alusta ühist redigeerimist', starting: 'Käivitamine…' },
  fi: { startSharedEditing: 'Aloita yhteismuokkaus', starting: 'Aloitetaan…' },
  fil: { startSharedEditing: 'Simulan ang sabayang pag-edit', starting: 'Sinisimulan…' },
  fr: { startSharedEditing: 'Démarrer la modification partagée', starting: 'Démarrage…' },
  ga: { startSharedEditing: 'Tosaigh eagarthóireacht chomhroinnte', starting: 'Á thosú…' },
  he: { startSharedEditing: 'התחלת עריכה משותפת', starting: 'מתחיל…' },
  hi: { startSharedEditing: 'साझा संपादन शुरू करें', starting: 'शुरू हो रहा है…' },
  hr: { startSharedEditing: 'Pokreni zajedničko uređivanje', starting: 'Pokretanje…' },
  hu: { startSharedEditing: 'Közös szerkesztés indítása', starting: 'Indítás…' },
  id: { startSharedEditing: 'Mulai penyuntingan bersama', starting: 'Memulai…' },
  is: { startSharedEditing: 'Hefja sameiginlega ritun', starting: 'Hef…' },
  it: { startSharedEditing: 'Avvia modifica condivisa', starting: 'Avvio…' },
  ja: { startSharedEditing: '共同編集を開始', starting: '開始中…' },
  ko: { startSharedEditing: '공동 편집 시작', starting: '시작 중…' },
  lt: { startSharedEditing: 'Pradėti bendrą redagavimą', starting: 'Pradedama…' },
  lv: { startSharedEditing: 'Sākt kopīgu rediģēšanu', starting: 'Tiek sākts…' },
  ms: { startSharedEditing: 'Mulakan penyuntingan bersama', starting: 'Memulakan…' },
  mt: { startSharedEditing: 'Ibda editjar konġunt', starting: 'Qed jibda…' },
  nl: { startSharedEditing: 'Gedeelde bewerking starten', starting: 'Bezig met starten…' },
  no: { startSharedEditing: 'Start delt redigering', starting: 'Starter…' },
  pl: { startSharedEditing: 'Rozpocznij wspólną edycję', starting: 'Uruchamianie…' },
  pt: { startSharedEditing: 'Iniciar edição partilhada', starting: 'A iniciar…' },
  ro: { startSharedEditing: 'Începe editarea colaborativă', starting: 'Se pornește…' },
  ru: { startSharedEditing: 'Начать совместное редактирование', starting: 'Запуск…' },
  sk: { startSharedEditing: 'Spustiť spoločné úpravy', starting: 'Spúšťanie…' },
  sl: { startSharedEditing: 'Začni skupno urejanje', starting: 'Začenjanje…' },
  sr: { startSharedEditing: 'Започни заједничко уређивање', starting: 'Покретање…' },
  sv: { startSharedEditing: 'Starta gemensam redigering', starting: 'Startar…' },
  sw: { startSharedEditing: 'Anza uhariri wa pamoja', starting: 'Inaanza…' },
  th: { startSharedEditing: 'เริ่มแก้ไขร่วมกัน', starting: 'กำลังเริ่ม…' },
  tr: { startSharedEditing: 'Paylaşımlı düzenlemeyi başlat', starting: 'Başlatılıyor…' },
  uk: { startSharedEditing: 'Почати спільне редагування', starting: 'Запуск…' },
  vi: { startSharedEditing: 'Bắt đầu chỉnh sửa chung', starting: 'Đang bắt đầu…' },
  'zh-CN': { startSharedEditing: '开始共同编辑', starting: '正在启动…' },
  'zh-HK': { startSharedEditing: '開始協作編輯', starting: '正在啟動…' },
  'zh-TW': { startSharedEditing: '開始共同編輯', starting: '正在啟動…' },
  zu: { startSharedEditing: 'Qala ukuhlela ngokubambisana', starting: 'Iyaqala…' },
  en: { startSharedEditing: 'Start shared editing', starting: 'Starting…' },
};

export function getCollaborationPanelCopy(locale: string): CollaborationPanelCopy & CollaborationPanelActionCopy {
  const copy = copyByLocale[locale] ?? english;
  return { ...copy, ...(actionCopyByLocale[locale] ?? actionCopyByLocale.en!) };
}
