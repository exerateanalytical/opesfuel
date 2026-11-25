export type Lang = 'fr' | 'en';

type Dict = Record<string, string>;

const fr: Dict = {
  appName: 'OpesFuel',
  // tabs
  tabHome: 'Accueil', tabPumps: 'Pompes', tabTanks: 'Cuves', tabSell: 'Vente', tabReports: 'Rapports', tabSend: 'Envoi', tabMore: 'Plus', tabMyShift: 'Mon poste', tabFleet: 'Flotte',
  // roles
  roleOWNER: 'Propriétaire', roleMANAGER: 'Gérant', roleATTENDANT: 'Pompiste', roleACCOUNTANT: 'Comptable',
  // common
  loading: 'Chargement…', retry: 'Réessayer', cancel: 'Annuler', confirm: 'Confirmer', save: 'Enregistrer', back: 'Retour', close: 'Fermer', ok: 'OK', yes: 'Oui', no: 'Non',
  updatedAt: 'Mis à jour à {time}', noData: 'Rien à afficher pour le moment.', pullToRefresh: 'Tirez vers le bas pour actualiser.',
  litres: 'Litres', fcfa: 'FCFA',
  // status pills
  online: 'En ligne', offline: 'Hors ligne', waiting: '{n} en attente',
  // sign in
  signInTitle: 'Connexion à votre station', signInSub: 'Connectez-vous avec votre compte OpesFuel pour voir votre station et enregistrer vos opérations.',
  signInBtn: 'Se connecter', signInError: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  notConfigured: 'Application non configurée. Contactez votre administrateur OpesFuel.',
  noWorkspace: 'Aucun espace de travail n’est lié à cet e-mail. Inscrivez-vous d’abord sur opesfuel.com, ou demandez une invitation à votre gérant, puis vérifiez votre e-mail.',
  unsupportedRole: 'Ce rôle utilise la console web OpesFuel. Cette application est destinée au propriétaire, au gérant, au pompiste et au comptable.',
  demoTitle: 'Mode démo (développement)', demoSub: 'Données d’exemple, rien n’est envoyé.',
  sessionExpired: 'Votre session a expiré. Reconnectez-vous.',
  signOut: 'Se déconnecter',
  // home
  hello: 'Bonjour, {name}', todayMoney: 'Argent du jour', revenue: 'Ventes', collected: 'Encaissé', variance: 'Écart', alerts: 'À traiter', allGood: 'Tout est en ordre. Aucune alerte.',
  pumpsOpen: 'Pompes ouvertes', openOfTotal: '{open} sur {total}',
  alertLowStock: 'Stock bas : {name} ({pct} %)', alertDip: 'Écart de jauge : {name} ({litres} L)', alertUnsent: '{n} opération(s) non envoyée(s)', alertFailed: '{n} opération(s) refusée(s) à vérifier',
  alertLongShift: 'Poste ouvert depuis {h} h sur {pump}', alertCredit: 'Crédit flotte presque atteint : {name}', alertShortage: 'Manquant de caisse : {amount} sur {pump}',
  // pumps
  pumps: 'Pompes', pumpOpen: 'OUVERTE', pumpIdle: 'LIBRE', attendant: 'Pompiste', meter: 'Compteur', priceL: '{p} FCFA/L',
  openShift: 'Ouvrir le poste', closeShift: 'Clôturer le poste', chooseAttendant: 'Choisir le pompiste', openingMeter: 'Compteur à l’ouverture', closingMeter: 'Compteur à la clôture',
  closingMeterHelp: 'Lisez le compteur de la pompe maintenant.', cash: 'Espèces', momo: 'Mobile Money', card: 'Carte', fleetCredit: 'Crédit flotte',
  soldLitres: 'Litres vendus', expected: 'Attendu', collectedTotal: 'Total encaissé', varianceOk: 'Caisse juste', varianceOver: 'Excédent de {amount}', varianceShort: 'Manquant de {amount}',
  varianceReason: 'Motif de l’écart (obligatoire)', closeConfirmTitle: 'Clôturer ce poste ?', closeConfirmBody: 'Cette action est définitive. Écart : {v}.',
  meterTooLow: 'Le compteur de clôture doit être supérieur à {m}.', fillMeter: 'Saisissez le compteur de clôture.', reasonRequired: 'Expliquez l’écart pour continuer.',
  shiftOpened: 'Poste ouvert sur {pump}.', shiftClosed: 'Poste clôturé sur {pump}.', noEmployee: 'Votre compte n’est pas relié à une fiche employé. Demandez à votre gérant.',
  noAttendants: 'Aucun pompiste disponible pour cette station.',
  clockIn: 'Pointer mon arrivée', clockOut: 'Pointer mon départ', clockedIn: 'Vous êtes pointé', clockedOut: 'Vous n’êtes pas pointé',
  // tanks
  tanks: 'Cuves', book: 'Stock théorique', lastDip: 'Dernière jauge', recordDip: 'Saisir une jauge', measured: 'Volume mesuré (litres)', dipSaved: 'Jauge enregistrée pour {name}.',
  lowStock: 'Stock bas', nominal: 'Normal', dipGap: 'Écart de {l} L', capacity: 'Capacité',
  // sell
  sell: 'Vente', fleetVoucher: 'Bon flotte', shopSale: 'Boutique', account: 'Compte client', plate: 'Plaque du véhicule', driver: 'Nom du chauffeur', grade: 'Carburant', litresDispensed: 'Litres servis', postVoucher: 'Enregistrer le bon',
  voucherSaved: 'Bon enregistré pour {plate}.', chooseAccount: 'Choisir un compte', noAccounts: 'Aucun compte flotte.', balance: 'Solde', limit: 'Plafond',
  item: 'Article', qty: 'Quantité', payment: 'Paiement', recordSale: 'Enregistrer la vente', saleSaved: 'Vente enregistrée : {name}.', inStock: 'En stock : {n}', outOfStock: 'Rupture de stock', noItems: 'Aucun article en boutique.',
  payCASH: 'Espèces', payMOBILE_MONEY: 'Mobile Money', payCARD: 'Carte', total: 'Total',
  // reports
  reports: 'Rapports', today: 'Aujourd’hui', shiftsToday: 'Postes clôturés', byAttendant: 'Par pompiste', netIncome: 'Résultat net', grossProfit: 'Marge brute', vatPayable: 'TVA à payer', expenses: 'Charges', cogs: 'Coût des ventes', trialOk: 'Comptabilité équilibrée', trialBad: 'Comptabilité déséquilibrée : à vérifier', reportUnavailable: 'Le rapport financier n’est pas disponible pour votre rôle.',
  // sync
  sendTitle: 'Envoi des données', sendNow: 'Envoyer maintenant', pendingTitle: 'En attente d’envoi', failedTitle: 'Refusées par le serveur', nothingPending: 'Tout est envoyé.', savedOnPhone: 'Enregistré sur ce téléphone. Il sera envoyé dès que le réseau revient.',
  sentN: '{n} opération(s) envoyée(s).', stillPending: 'Toujours en attente : pas de réseau.', discard: 'Supprimer', connected: 'Connecté au serveur', notConnected: 'Pas de connexion au serveur', lastSync: 'Dernier envoi : {time}', never: 'jamais',
  // more
  more: 'Plus', language: 'Langue', french: 'Français', english: 'English', station: 'Station', setup: 'Configuration des carburants', ai: 'Assistant IA', version: 'Version',
  // setup
  setupSub: 'Choisissez les carburants vendus dans cette station.', openingStock: 'Stock initial', saveConfig: 'Enregistrer la configuration', configSaved: 'Configuration enregistrée.',
  // ai
  aiTitle: 'Assistant IA de la station', aiSub: 'Posez une question sur vos stocks, vos écarts de caisse ou vos ventes.', aiPlaceholder: 'Ex. Quelle cuve faut-il recompléter en premier ?', aiAsk: 'Demander', aiThinking: 'Réflexion…', aiUnavailable: 'L’assistant IA n’est pas activé pour cette station.',
  // errors
  errGeneric: 'Une erreur est survenue. Réessayez.', errForbidden: 'Vous n’avez pas le droit de faire cette action.', errConflict: 'Action refusée : {detail}', errNetwork: 'Pas de réseau.', errRequired: 'Remplissez tous les champs.', errNumber: 'Saisissez un nombre valide.',
};

const en: Dict = {
  appName: 'OpesFuel',
  tabHome: 'Home', tabPumps: 'Pumps', tabTanks: 'Tanks', tabSell: 'Sell', tabReports: 'Reports', tabSend: 'Sync', tabMore: 'More', tabMyShift: 'My shift', tabFleet: 'Fleet',
  roleOWNER: 'Owner', roleMANAGER: 'Manager', roleATTENDANT: 'Attendant', roleACCOUNTANT: 'Accountant',
  loading: 'Loading…', retry: 'Retry', cancel: 'Cancel', confirm: 'Confirm', save: 'Save', back: 'Back', close: 'Close', ok: 'OK', yes: 'Yes', no: 'No',
  updatedAt: 'Updated at {time}', noData: 'Nothing to show yet.', pullToRefresh: 'Pull down to refresh.',
  litres: 'Litres', fcfa: 'FCFA',
  online: 'Online', offline: 'Offline', waiting: '{n} waiting',
  signInTitle: 'Sign in to your station', signInSub: 'Sign in with your OpesFuel account to see your station and record your work.',
  signInBtn: 'Sign in', signInError: 'Could not sign in. Check your network and try again.',
  notConfigured: 'The app is not configured. Contact your OpesFuel administrator.',
  noWorkspace: 'No workspace is linked to this email. Sign up on opesfuel.com first, or ask your manager for an invitation, then verify your email.',
  unsupportedRole: 'This role uses the OpesFuel web console. This app is for owners, managers, attendants and accountants.',
  demoTitle: 'Demo mode (development)', demoSub: 'Sample data, nothing is sent.',
  sessionExpired: 'Your session expired. Please sign in again.',
  signOut: 'Sign out',
  hello: 'Hello, {name}', todayMoney: 'Today’s money', revenue: 'Sales', collected: 'Collected', variance: 'Variance', alerts: 'Needs attention', allGood: 'All good. No alerts.',
  pumpsOpen: 'Open pumps', openOfTotal: '{open} of {total}',
  alertLowStock: 'Low stock: {name} ({pct}%)', alertDip: 'Dip gap: {name} ({litres} L)', alertUnsent: '{n} action(s) not sent yet', alertFailed: '{n} action(s) rejected, please check',
  alertLongShift: 'Shift open for {h} h on {pump}', alertCredit: 'Fleet credit almost reached: {name}', alertShortage: 'Cash shortage: {amount} on {pump}',
  pumps: 'Pumps', pumpOpen: 'OPEN', pumpIdle: 'IDLE', attendant: 'Attendant', meter: 'Meter', priceL: '{p} FCFA/L',
  openShift: 'Open shift', closeShift: 'Close shift', chooseAttendant: 'Choose attendant', openingMeter: 'Opening meter', closingMeter: 'Closing meter',
  closingMeterHelp: 'Read the pump meter now.', cash: 'Cash', momo: 'Mobile Money', card: 'Card', fleetCredit: 'Fleet credit',
  soldLitres: 'Litres sold', expected: 'Expected', collectedTotal: 'Total collected', varianceOk: 'Cash is correct', varianceOver: 'Over by {amount}', varianceShort: 'Short by {amount}',
  varianceReason: 'Reason for the gap (required)', closeConfirmTitle: 'Close this shift?', closeConfirmBody: 'This cannot be undone. Variance: {v}.',
  meterTooLow: 'Closing meter must be above {m}.', fillMeter: 'Enter the closing meter.', reasonRequired: 'Explain the gap to continue.',
  shiftOpened: 'Shift opened on {pump}.', shiftClosed: 'Shift closed on {pump}.', noEmployee: 'Your login is not linked to an employee record. Ask your manager.',
  noAttendants: 'No attendant available for this station.',
  clockIn: 'Clock in', clockOut: 'Clock out', clockedIn: 'You are clocked in', clockedOut: 'You are not clocked in',
  tanks: 'Tanks', book: 'Book stock', lastDip: 'Last dip', recordDip: 'Record a dip', measured: 'Measured volume (litres)', dipSaved: 'Dip saved for {name}.',
  lowStock: 'Low stock', nominal: 'Normal', dipGap: 'Gap of {l} L', capacity: 'Capacity',
  sell: 'Sell', fleetVoucher: 'Fleet voucher', shopSale: 'Shop', account: 'Customer account', plate: 'Vehicle plate', driver: 'Driver name', grade: 'Fuel', litresDispensed: 'Litres dispensed', postVoucher: 'Save voucher',
  voucherSaved: 'Voucher saved for {plate}.', chooseAccount: 'Choose an account', noAccounts: 'No fleet accounts.', balance: 'Balance', limit: 'Limit',
  item: 'Item', qty: 'Quantity', payment: 'Payment', recordSale: 'Record sale', saleSaved: 'Sale recorded: {name}.', inStock: 'In stock: {n}', outOfStock: 'Out of stock', noItems: 'No shop items.',
  payCASH: 'Cash', payMOBILE_MONEY: 'Mobile Money', payCARD: 'Card', total: 'Total',
  reports: 'Reports', today: 'Today', shiftsToday: 'Closed shifts', byAttendant: 'By attendant', netIncome: 'Net income', grossProfit: 'Gross profit', vatPayable: 'VAT payable', expenses: 'Expenses', cogs: 'Cost of sales', trialOk: 'Books are balanced', trialBad: 'Books are out of balance: please check', reportUnavailable: 'The financial report is not available for your role.',
  sendTitle: 'Sending data', sendNow: 'Send now', pendingTitle: 'Waiting to send', failedTitle: 'Rejected by the server', nothingPending: 'Everything is sent.', savedOnPhone: 'Saved on this phone. It will be sent when the network is back.',
  sentN: '{n} action(s) sent.', stillPending: 'Still waiting: no network.', discard: 'Discard', connected: 'Connected to the server', notConnected: 'No connection to the server', lastSync: 'Last sent: {time}', never: 'never',
  more: 'More', language: 'Language', french: 'Français', english: 'English', station: 'Station', setup: 'Fuel setup', ai: 'AI assistant', version: 'Version',
  setupSub: 'Choose the fuels sold at this station.', openingStock: 'Opening stock', saveConfig: 'Save configuration', configSaved: 'Configuration saved.',
  aiTitle: 'Station AI assistant', aiSub: 'Ask about your stock, cash variances or sales.', aiPlaceholder: 'E.g. Which tank should I refill first?', aiAsk: 'Ask', aiThinking: 'Thinking…', aiUnavailable: 'The AI assistant is not enabled for this station.',
  errGeneric: 'Something went wrong. Try again.', errForbidden: 'You are not allowed to do this.', errConflict: 'Action refused: {detail}', errNetwork: 'No network.', errRequired: 'Fill in all fields.', errNumber: 'Enter a valid number.',
};

export const DICTS: Record<Lang, Dict> = { fr, en };

export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function detectDeviceLang(): Lang {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || '';
    return loc.toLowerCase().startsWith('en') ? 'en' : 'fr'; // French by default for the Cameroon market
  } catch {
    return 'fr';
  }
}

