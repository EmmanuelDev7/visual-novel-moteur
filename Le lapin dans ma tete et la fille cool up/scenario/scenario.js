/* ============================================================
   SCÉNARIO PRINCIPAL — scenario.js
   ============================================================
   Ce fichier assemble tous les chapitres en un seul SCRIPT.

   COMMENT AJOUTER UN NOUVEAU CHAPITRE :
   1. Créez un fichier  scenario_ch2.js  (par exemple)
   2. Déclarez-y une const CHAPTER_2 = [ ... ]
   3. Importez-le dans index.html AVANT scenario.js
   4. Ajoutez  ...CHAPTER_2  dans le tableau ci-dessous

   Chaque fichier chapitre est indépendant et lisible seul.
   Les labels doivent rester uniques sur TOUT le projet.
   Convention : préfixez les labels par le chapitre → ch1_, ch2_, etc.
   ============================================================ */

const SCRIPT = [
  ...INTRODUCTION, // intro.js
];

/*
 * ─────────────────────────────────────────────────────────────
 * EXEMPLE DE STRUCTURE POUR UN PROJET MULTI-ROUTES
 * ─────────────────────────────────────────────────────────────
 *
 * scenario_prologue.js   → const PROLOGUE
 * scenario_ch1.js        → const CHAPTER_1
 * scenario_ch2.js        → const CHAPTER_2
 * scenario_route_a.js    → const ROUTE_A   (route Sarah)
 * scenario_route_b.js    → const ROUTE_B   (route Armel)
 * scenario_ending_a.js   → const ENDING_A  (bonne fin)
 * scenario_ending_b.js   → const ENDING_B  (mauvaise fin)
 *
 * Dans index.html, chargez dans l'ordre :
 *   <script src="scenario_prologue.js"></script>
 *   <script src="scenario_ch1.js"></script>
 *   <script src="scenario_ch2.js"></script>
 *   <script src="scenario_route_a.js"></script>
 *   <script src="scenario_route_b.js"></script>
 *   <script src="scenario_ending_a.js"></script>
 *   <script src="scenario_ending_b.js"></script>
 *   <script src="scenario.js"></script>   ← l'assembleur, EN DERNIER
 *   <script src="engine.js"></script>     ← le moteur, APRÈS scenario.js
 * ─────────────────────────────────────────────────────────────
 */
