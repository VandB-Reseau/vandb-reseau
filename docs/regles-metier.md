# Règles métier

Les décisions prises avec Joseph (Directeur de réseau) qui ne se lisent pas toutes dans le code. À respecter dans tout
changement ; en cas de doute, lui poser la question plutôt que de trancher seul. Les dates sont celles de la décision.

## Le réseau et les personnes

- **Vocabulaire** : Coach, RR (Responsable Régional), Directeur de réseau, magasin, Franchisé, Associés (pour un magasin
  intégré). Jamais « CS », « DR », « Responsable magasin », adjoint ni plateforme logistique à l'écran.
- **Rôles** (`src/auth/roles.ts`, lus en base par `mon_acces()`) :
  - Directeur : tout le réseau, seul à écrire les référentiels (magasins, affectations, équipe, campagnes, grilles,
    réglages) et les paramètres ;
  - RR et Coach : les magasins de leur périmètre (`perimetre_equipe`), écrivent visites, chiffres, suivi, bonnes
    pratiques, agenda, messages ; pas de Paramètres ;
  - Franchisé : ses magasins seulement, par `espace_franchise()` (aucune table lue directement), sauf dans le schéma
    `pilotage` où il lit et écrit les lignes de ses magasins ; ne voit jamais les médianes ni les comparaisons du réseau ;
  - Direction (24/11/2026) : lecture de tout le réseau comme le Directeur, écrit seulement dans le carnet du magasin ;
  - Contrôle de gestion : compte désigné dans les paramètres des budgets, lit les budgets et chiffres de tous les
    magasins, modifie les paramètres du réseau avec le Directeur.
- « Le siège propose, on se met d'accord » : le budget d'un magasin est proposé par le siège, discuté avec le franchisé,
  validé par le RR (ses magasins) ou le Directeur. Le RR valide ou rouvre sans modifier.
- Données rangées par magasin : dans `suivi_magasins` (une ligne par magasin et par rubrique), jamais dans une clé
  d'`app_config`. Une seule liste de tâches pour tout (visites, campagnes, budget, marché extérieur).
- Date d'ouverture d'un magasin : `store_overrides.open_date` (fiche magasin).

## Carnet et commentaires

- **Carnet** (25/11/2026) : réservé à l'équipe par définition, sans mention « Équipe seule » à l'écran. Page « Carnet »
  (rubrique Réseau) : toutes les notes du périmètre, tout le réseau pour le Directeur et la Direction, le secteur pour un
  RR, ses magasins pour un Coach. Les alertes et points à surveiller ouverts en tête ; « Je m'en occupe » met son nom
  sur la note (champ `prise`) jusqu'à la clôture.
- **Écrire une note** (25/11/2026) : style messagerie, une barre compacte (texte, micro, envoyer) ; le ton (Alerte,
  À surveiller, Positif, Info, « Info » par défaut) se choisit dans une pastille, thèmes et collègues prévenus dans des
  menus ou en tapant « @ ». Depuis une visite (étapes Visite et Après), « Au carnet du magasin » ajoute des notes liées à
  la visite (champ `visite`), qui remplacent les « remarques internes » et leur appréciation.
- **Plus de note à la volée** (25/11/2026) : une note s'écrit dans le carnet ; « Note » quitte le « + » général et la
  recherche, le « + » de la fiche propose « Note au carnet » (le carnet s'ouvre, prêt à écrire). Les notes déjà saisies
  étaient rangées au même endroit : rien à reprendre.
- **Compte rendu d'échange** (25/11/2026) : « Appel » ouvre une petite fenêtre (Appel ou Point, date, ce qui s'est dit),
  sans titre, sans signature, sans envoi. Rangé comme une visite de type `appel` ou `point`, lu dans le carnet et
  l'historique du magasin ; jamais renvoyé au franchisé (types écartés par `espace_franchise()`).
- **Commentaires du budget** (25/11/2026) : toujours lus par le franchisé, plus de choix « Équipe seule ». Ceux écrits
  ainsi avant restent cachés au franchisé.

## Chiffres de vente

- **Source unique du CA : la caisse** (03/11/2026). Le CA mensuel est importé chaque mois depuis l'export de la DSI
  (format : [import-caisse.md](import-caisse.md)), par univers (Cave, Bar, Extérieur) et famille. L'ancienne saisie
  manuelle (`store_finance`) est archivée puis fermée (migrations 0040, 0041).
- **Cave et Bar ne s'additionnent jamais** pour les tickets et le panier moyen (ce sont deux clientèles).
- Modèles d'import téléchargeables depuis l'app ; le code magasin `EXEMPLE` n'est jamais importé.

## Budget (pilotage financier)

- Le modèle à reproduire est l'Excel prévisionnel des magasins (hors dépôt, jamais versé : données réelles).
- **Montants HT** dans tous les calculs ; le TTC ne sert qu'à la trésorerie et aux paniers saisis.
- **Redevance 2 % et publicité 1 % du CA HT, au-dessus de l'EBE.** Ligne « budget communication » : 2,5 % du CA par an,
  en plus de la publicité réseau (communication propre au magasin, dans ses charges).
- Année de 12 mois, poids mensuels qui font 100 %.
- Le budget de l'année suivante se construit une fois, en fin d'année, depuis l'**atterrissage** de l'année en cours :
  budget d'un univers = CA atterri × (1 + évolution des tickets) × (1 + évolution du panier). Un seul compte de résultat.
- Atterrissage : depuis l'ouverture ; saisonnalité par univers ; saisonnalité du magasin seulement si l'année précédente
  est complète ; magasin de moins de 18 mois = rythme des 4 derniers mois × saisonnalité du réseau ; sinon médiane du
  réseau (au moins 3 magasins). Correction manuelle par la carte « Point de départ du budget ».
- **Marge** : marge théorique = mix des familles de la caisse ; démarque en % du CA, la même pour toutes les familles.
  Hypothèses réglées par univers (tickets, panier, marge visée), détail par famille replié.
- **Équipe** : postes anonymes, gérant TNS, primes annuelles, taux de charges par catégorie et réduction générale,
  extras = un poste comme un autre, hausses de salaire datées par poste. Provision congés payés ≈ 10 % du salaire de base
  des salariés, chargée (ni TNS, ni extras, ni primes). Ratio affiché « % FP » = frais de personnel ÷ CA HT.
- **Frais** : lignes de l'onglet des frais de l'Excel (charges externes, impôts et taxes, autres charges ; sous l'EBE
  amortissements et intérêts). Formation, taxe d'apprentissage, CSG dans la masse salariale.
- **Prêts** : saisis une fois par magasin (capital restant ou date de 1re échéance + mensualité) ; un prêt est déjà
  dépensé : jamais d'encaissement en trésorerie, seules les échéances sortent. Un achat financé par prêt se saisit
  seulement en prêt (donc pas d'amortissement calculé pour lui).
- **Trésorerie du budget** : ventes encaissées le mois, TVA mensuelle, 40 % du personnel payé le mois suivant,
  marchandise vendue en M payée en M ; consignes Cave 3 %, Bar et Extérieur 15 %. Stock cible au prix d'achat : Cave
  2,5 mois de ventes, Bar 1 mois, Extérieur réglable. Le creux de janvier est l'effet Noël normal.
- **Quadrimestres** (réel comptable tous les 4 mois) : le franchisé saisit achats, variation de stock, charges externes,
  impôts et taxes, personnel, trésorerie ; l'EBE est calculé. Marge réelle = CA − (achats − variation de stock), l'écart
  à la marge théorique est la démarque. Import du FEC par racines du plan comptable, avec exceptions par magasin. Le réel
  de trésorerie ne se pilote qu'au quadrimestre.
- **Alertes** : 5 % sous le budget, 1 point de marge, 1 mois de retard de saisie, trésorerie sous 0 € ; tickets et
  panier 5 % / 3 % sur 3 mois.
- Paramètres du réseau figés dans le budget à sa validation : un changement de paramètre ne fait jamais bouger seul un
  budget validé.

## Simulateurs

- Hors taxes pour les ventes aux entreprises, TTC pour les particuliers. Perte standard des fûts 7 %. Dons et mécénat :
  réduction d'impôt de 60 %, reçu Cerfa demandé, case par don. Remises au bar : conformité loi Évin.
- Un simulateur gardé est une ligne de `pilotage.simulations` (un type par simulateur).

## Écrans

- PC d'abord (menu latéral, tableaux complets), téléphone soigné (barre basse, zones tactiles ≥ 48 px).
- Aucun texte sous 12 px, aucune explication de l'outil affichée d'office : l'aide passe par l'icône (i).
- Aucune erreur technique à l'écran : un message humain, un état vide qui propose l'action.
- Couleurs et polices de la charte V and B (`src/theme/theme.ts`), icônes `@mui/icons-material`, pas d'emojis.
- Statuts : 4 tons (rouge Agir, orange Surveiller, vert Bon, gris Neutre) et un lexique fermé (`LEXIQUE_STATUTS`).

Le détail des règles d'interface et de code est dans [CLAUDE.md](../CLAUDE.md) et [architecture.md](architecture.md).
