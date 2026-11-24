"use client";

import { useState } from "react";
import {
  Accessibility,
  CheckCircle2,
  Eye,
  ListChecks,
  MousePointerClick,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import type { LabSessionState } from "@/lib/science-adapters";
import { getDictionary, getExperimentCopy } from "@/lib/i18n";
import type { ExperimentDefinition, LabMode, Locale, Quantity } from "@/lib/types";

export interface DispatchActionArgs {
  targetObjectId: string;
  actionType: string;
  parametersWithUnits?: Record<string, Quantity>;
  interactionPort?: string;
  choiceId?: string;
}

interface LabStageCanvasProps {
  definition: ExperimentDefinition;
  mode: LabMode;
  locale: Locale;
  state: LabSessionState;
  revision: number;
  isOffline?: boolean;
  hasUnsavedIntent?: boolean;
  disabled: boolean;
  onDispatch: (args: DispatchActionArgs) => Promise<void>;
}

export function LabStageCanvas({
  definition,
  mode,
  locale,
  state,
  revision,
  isOffline = false,
  hasUnsavedIntent = false,
  disabled,
  onDispatch,
}: LabStageCanvasProps) {
  const dict = getDictionary(locale);
  const isTe = locale === "te-IN";
  const copy = getExperimentCopy(definition.experimentId, locale, definition.subject);
  const [showEquipmentDrawer, setShowEquipmentDrawer] = useState(false);
  const [domAccessibleMode, setDomAccessibleMode] = useState(false);
  const [viewZoom, setViewZoom] = useState(1);

  const subject = definition.subject;

  // Discrete keyboard/screen-reader & pointer hotspot actions that call the EXACT same API action executor
  const equipmentActions: Array<{
    id: string;
    shortHotspotLabel: string;
    label: string;
    detail: string;
    dangerGuard?: boolean;
    args: DispatchActionArgs;
  }> =
    subject === "chemistry"
      ? [
          {
            id: "connect-soap",
            shortHotspotLabel: isTe
              ? "1. డెలివరీ ట్యూబ్ → సబ్బు ద్రావణం కలపండి"
              : "1. Connect delivery tube → soap receiver",
            label: isTe
              ? "డెలివరీ ట్యూబ్‌ను సబ్బు-ద్రావణ గ్రాహకానికి కలపండి (port_soap_receiver)"
              : "Connect delivery tube → soap-solution receiver (port_soap_receiver)",
            detail: isTe
              ? "చెల్లుబాటు అయ్యే కృత్యం 2.3 పరికరాల అమరిక"
              : "Valid Activity 2.3 apparatus setup",
            args: {
              targetObjectId: "chem.transfer:1",
              actionType: "setup_apparatus",
              interactionPort: "port_soap_receiver",
            },
          },
          {
            id: "identify-zn",
            shortHotspotLabel: isTe
              ? "2. జింక్ కణికలు (Zn) ధృవీకరించండి"
              : "2. Verify Zinc granules (Zn)",
            label: isTe
              ? "క్రియాజనకాన్ని ధృవీకరించండి: జింక్ కణికలు (Zn)"
              : "Verify reactant: Zinc granules (Zn)",
            detail: isTe ? "ఆమోదించబడిన ఘన లోహం" : "Admitted Activity 2.3 solid metal",
            args: {
              targetObjectId: "chem.reaction-tube:1",
              actionType: "identify_reagent",
              choiceId: "Zn",
            },
          },
          {
            id: "identify-h2so4",
            shortHotspotLabel: isTe
              ? "3. సజల H₂SO₄ ధృవీకరించండి"
              : "3. Verify dilute H₂SO₄",
            label: isTe
              ? "క్రియాజనకాన్ని ధృవీకరించండి: సజల సల్ఫ్యూరిక్ ఆమ్లం (dilute_H2SO4)"
              : "Verify reactant: Dilute sulfuric acid (dilute_H2SO4)",
            detail: isTe ? "ఆమోదించబడిన ఆమ్ల కారకం" : "Admitted Activity 2.3 acid reagent",
            args: {
              targetObjectId: "chem.reaction-tube:1",
              actionType: "identify_reagent",
              choiceId: "dilute_H2SO4",
            },
          },
          {
            id: "run-default-bound",
            shortHotspotLabel: isTe
              ? "4. స్టోయికియోమెట్రీ గణన అమలు చేయండి"
              : "4. Run bounded stoichiometry check",
            label: isTe
              ? "పరిమిత స్టోయికియోమెట్రీ గణన (2.0 µmol Zn + 3.0 µmol H⁺ eq)"
              : "Run bounded stoichiometry fixture (2.0 µmol Zn + 3.0 µmol H⁺ eq)",
            detail: isTe
              ? "సైద్ధాంతిక గరిష్ట పరిమితి 1.5 µmol H₂ ను గణిస్తుంది"
              : "Computes theoretical upper bound 1.5 µmol H₂",
            args: {
              targetObjectId: "chem.reaction-tube:1",
              actionType: "propose_virtual_amount",
              parametersWithUnits: {
                zincAmount: { value: state.zincUmol ?? 2.0, unit: "umol" },
                acidEquivalent: { value: state.acidEqUmol ?? 3.0, unit: "umol" },
              },
            },
          },
          {
            id: "guard-bad-port",
            shortHotspotLabel: isTe
              ? "భద్రతా తనిఖీ: బహిరంగ గాలికి కలపండి (422)"
              : "Safety check: Open air port (422)",
            label: isTe
              ? "భద్రతా తనిఖీ: ట్యూబ్‌ను బహిరంగ గాలికి కలపండి (422 BAD_PORT అంచనా)"
              : "Test safety guard: Connect tube to open air (expect 422 BAD_PORT)",
            detail: isTe
              ? "రివిజన్ మారకుండా చెల్లని పోర్ట్ తిరస్కరించబడుతుందని నిర్ధారిస్తుంది"
              : "Verifies invalid port is rejected without changing revision",
            dangerGuard: true,
            args: {
              targetObjectId: "chem.transfer:1",
              actionType: "setup_apparatus",
              interactionPort: "port_open_air",
            },
          },
          {
            id: "guard-bad-reagent",
            shortHotspotLabel: isTe
              ? "భద్రతా తనిఖీ: HCl ప్రత్యామ్నాయం (422)"
              : "Safety check: Substitute HCl (422)",
            label: isTe
              ? "భద్రతా తనిఖీ: HCl ను ప్రత్యామ్నాయం చేయండి (422 INCOMPATIBLE_MATERIAL అంచనా)"
              : "Test safety guard: Substitute HCl (expect 422 INCOMPATIBLE_MATERIAL)",
            detail: isTe
              ? "మద్దతు లేని ఆమ్లాలు సున్నా మార్పుతో నిరోధించబడతాయని నిర్ధారిస్తుంది"
              : "Verifies unsupported acids are blocked with zero mutation",
            dangerGuard: true,
            args: {
              targetObjectId: "chem.reaction-tube:1",
              actionType: "identify_reagent",
              choiceId: "HCl",
            },
          },
        ]
      : subject === "physics"
        ? [
            {
              id: "mount-slab",
              shortHotspotLabel: isTe
                ? "1. సమాంతర గాజు దిమ్మెను అమర్చండి"
                : "1. Mount parallel glass slab",
              label: isTe
                ? "సమాంతర గాజు దిమ్మెను లంబానికి అనుగుణంగా అమర్చండి (port_parallel_normal)"
                : "Mount parallel glass slab aligned to normal (port_parallel_normal)",
              detail: isTe
                ? "చెల్లుబాటు అయ్యే కృత్యం 9.10 దృశా అమరిక"
                : "Valid Activity 9.10 optical alignment",
              args: {
                targetObjectId: "phys.glass-slab:1",
                actionType: "place_optic",
                interactionPort: "port_parallel_normal",
              },
            },
            {
              id: "trace-45",
              shortHotspotLabel: isTe
                ? "2. 45° పతన కిరణాన్ని గుర్తించండి"
                : "2. Trace 45° incident ray",
              label: isTe
                ? "20 mm గాజు దిమ్మె ద్వారా 45° వద్ద పతన కిరణాన్ని గుర్తించండి"
                : "Trace incident ray at 45° through 20 mm slab",
              detail: isTe
                ? "సైద్ధాంతిక స్నెల్ గణన (r = 28.13°, పార్శ్వ విస్థాపనం = 6.58 mm)"
                : "Theoretical Snell trace (r = 28.13°, offset = 6.58 mm)",
              args: {
                targetObjectId: "phys.glass-slab:1",
                actionType: "select_incident_ray",
                parametersWithUnits: {
                  angle: { value: state.incidentAngleDeg ?? 45, unit: "deg" },
                  slabThickness: { value: state.slabThicknessMm ?? 20, unit: "mm" },
                },
              },
            },
            {
              id: "trace-30",
              shortHotspotLabel: isTe
                ? "3. 30° పోలిక కిరణాన్ని గుర్తించండి"
                : "3. Trace 30° comparison ray",
              label: isTe
                ? "20 mm గాజు దిమ్మె ద్వారా 30° వద్ద పోలిక కిరణాన్ని గుర్తించండి"
                : "Trace comparison ray at 30° through 20 mm slab",
              detail: isTe ? "0–60° పరిధిలో పోలిక కోణం" : "Comparison angle within 0–60° domain",
              args: {
                targetObjectId: "phys.glass-slab:1",
                actionType: "select_incident_ray",
                parametersWithUnits: {
                  angle: { value: 30, unit: "deg" },
                  slabThickness: { value: state.slabThicknessMm ?? 20, unit: "mm" },
                },
              },
            },
            {
              id: "guard-angle-oob",
              shortHotspotLabel: isTe
                ? "పరిధి తనిఖీ: 75° కోణం (422)"
                : "Domain check: 75° angle (422)",
              label: isTe
                ? "పరిధి తనిఖీ: పతన కోణం 75° (422 OUTSIDE_DOMAIN అంచనా)"
                : "Test domain guard: Incident angle 75° (expect 422 OUTSIDE_DOMAIN)",
              detail: isTe
                ? "పరిధి వెలుపలి కోణం తిరస్కరించబడుతుందని నిర్ధారిస్తుంది"
                : "Verifies out-of-range angle is rejected without mutation",
              dangerGuard: true,
              args: {
                targetObjectId: "phys.glass-slab:1",
                actionType: "select_incident_ray",
                parametersWithUnits: {
                  angle: { value: 75, unit: "deg" },
                  slabThickness: { value: 20, unit: "mm" },
                },
              },
            },
          ]
        : [
            {
              id: "select-field-1",
              shortHotspotLabel: isTe
                ? "1. ఉల్లిపొర స్లైడ్ ఫీల్డ్ 1 లోడ్ చేయండి"
                : "1. Load onion slide Field 1",
              label: isTe
                ? "సిద్ధం చేసిన ఉల్లిపొర స్లైడ్‌ను లోడ్ చేయండి — ఫీల్డ్ 1"
                : "Load prepared onion epidermis slide — Field 1",
              detail: isTe ? "గుణాత్మక పరిశీలన వీక్షణ" : "Discrete acquired fixture field (qualitative view)",
              args: {
                targetObjectId: "bio.prepared-onion-slide:1",
                actionType: "select_field",
                parametersWithUnits: { fieldIndex: { value: 1, unit: "1" } },
              },
            },
            {
              id: "select-plane-1",
              shortHotspotLabel: isTe
                ? "2. మైక్రోస్కోప్ ఫోకస్ ప్లేన్ 1"
                : "2. Focus microscope Plane 1",
              label: isTe
                ? "మైక్రోస్కోప్‌ను ప్లేన్ 1 కు ఫోకస్ చేయండి"
                : "Focus microscope to acquired plane 1",
              detail: isTe ? "0–2 స్టాక్‌లో ఫోకస్ సూచిక" : "Discrete focus index within 0–2 stack",
              args: {
                targetObjectId: "bio.compound-microscope:1",
                actionType: "select_acquired_plane",
                parametersWithUnits: { fixturePlaneIndex: { value: 1, unit: "1" } },
              },
            },
            {
              id: "mark-cell-wall",
              shortHotspotLabel: isTe
                ? "3. కణ కవచ సరిహద్దును గుర్తించండి"
                : "3. Mark plant cell wall boundary",
              label: isTe
                ? "కనిపించే వృక్ష కణ కవచ సరిహద్దును గుర్తించండి"
                : "Annotate visible plant cell wall boundary",
              detail: isTe
                ? "నిర్ధారించిన గుణాత్మక నిర్మాణ పరిశీలనను నమోదు చేస్తుంది"
                : "Records confirmed qualitative morphology observation",
              args: {
                targetObjectId: "bio.image-view:1",
                actionType: "mark_visible_boundary",
                choiceId: "cell_wall",
              },
            },
            {
              id: "guard-uncalibrated",
              shortHotspotLabel: isTe
                ? "కాలిబ్రేషన్ తనిఖీ: µm కొలత (422)"
                : "Calibration check: µm length (422)",
              label: isTe
                ? "కాలిబ్రేషన్ తనిఖీ: µm పొడవు కొలవండి (422 CALIBRATION_MISSING అంచనా)"
                : "Test calibration guard: Measure µm length (expect 422 CALIBRATION_MISSING)",
              detail: isTe
                ? "కాలిబ్రేట్ చేసిన మైక్రోగ్రాఫ్‌లు లేకుండా పరిమాణాత్మక కొలత నిరోధించబడుతుంది"
                : "Verifies quantitative length is blocked pending calibrated micrographs",
              dangerGuard: true,
              args: {
                targetObjectId: "bio.scale-overlay:1",
                actionType: "measure_cell_length",
                parametersWithUnits: { distance: { value: 100, unit: "px" } },
              },
            },
          ];

  const stageActions = mode === "simulation" ? equipmentActions : equipmentActions.filter(action =>
    action.id === "connect-soap" || action.id === "mount-slab" || action.id === "mark-cell-wall" || action.id === "guard-uncalibrated",
  );

  return (
    <div
      className="g1-card flex h-full flex-col p-3"
      style={{
        background: "linear-gradient(180deg, #e3f6fb 0%, #f3fbff 100%)",
        borderColor: "#bfe0eb",
      }}
    >
      <div
        className="relative flex min-h-[410px] flex-1 flex-col overflow-hidden rounded-[18px] p-4 sm:min-h-[505px]"
        style={{
          background:
            "radial-gradient(ellipse at 70% 25%, #f5fdff 0%, #d3edf5 65%, #b6d9e7 100%)",
        }}
      >
        {/* Top stage badges matching 03_Simulation_Player_Premium.png */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/92 px-3.5 py-2 text-xs font-extrabold text-[#1f607d] shadow-xs">
            <span>◈</span>
            <span>
              {domAccessibleMode ? dict.player.accessibleDomMode : dict.player.illustrativeView}
            </span>
          </span>
          <span className="g1-tag bg-white/90 font-mono text-[11px] text-[#355670]">
            {definition.sceneId} · {mode === "simulation" ? "GUIDED" : "INQUIRY"}
          </span>
        </div>

        {/* Main stage area: either interactive visual concept canvas OR pure 2D accessible DOM controls */}
        {domAccessibleMode ? (
          <div
            tabIndex={0}
            aria-label={isTe ? "2D అందుబాటులో ఉండే ప్రయోగశాల నియంత్రణలు" : "2D Accessible laboratory controls"}
            className="relative z-10 my-4 flex-1 overflow-y-auto rounded-2xl border border-[#cde6f5] bg-white p-5"
          >
            <h3 className="text-base font-extrabold text-[#0c2444]">
              {isTe
                ? "2D అందుబాటులో ఉండే DOM నియంత్రణలు (WCAG 2.2 AA సమానత్వం)"
                : "2D Accessible DOM Control Equivalent (WCAG 2.2 AA Parity)"}
            </h3>
            <p className="mt-1 text-xs text-[#4b637a]">
              {isTe
                ? "క్రింది ప్రతి చర్య పాయింటర్ ఇంటరాక్షన్‌తో సమానమైన సర్వర్ ఆదేశాన్ని పంపుతుంది మరియు అదే రూబ్రిక్ ఫలితాన్ని ఇస్తుంది."
                : "Every action below submits the exact same typed server command and earns the exact same rubric credit as pointer interaction."}
            </p>
            <div className="mt-4 space-y-2.5">
              {stageActions.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => void onDispatch(act.args)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-xs font-bold transition-colors ${
                    act.dangerGuard
                      ? "border-[#f3d1c9] bg-[#fff9f8] text-[#912018] hover:bg-[#fef3f2]"
                      : "border-[#cde3f2] bg-[#f7fbff] text-[#0c2444] hover:bg-[#e9f5ff]"
                  }`}
                  data-testid={`dom-action-${act.id}`}
                >
                  <div>
                    <div>{act.label}</div>
                    <div className="mt-0.5 font-normal text-[#4b637a]">{act.detail}</div>
                  </div>
                  <span className="shrink-0 text-[11px] font-extrabold text-[#007875]">
                    {isTe ? "అమలు చేయి →" : "Run →"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative flex flex-1 flex-col items-center justify-center py-3">
            <div
              className="relative flex w-full max-w-[740px] items-center justify-center transition-transform duration-150"
              style={{ transform: `scale(${viewZoom})` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={copy.imagePath}
                alt={`${copy.title} — ${isTe ? "పరికరాల నమూనా చిత్రం (కొలతకు కాదు)" : "apparatus diagram (illustrative concept, not to scale)"}`}
                className="max-h-[340px] w-full rounded-xl object-contain drop-shadow-sm"
              />
            </div>

            {/* Interactive Stage Hotspots (G1-34: pointer + keyboard parity right on the visual canvas) */}
            <div
              aria-label={isTe ? "ఇంటరాక్టివ్ పరికరాల హాట్‌స్పాట్‌లు" : "Interactive apparatus stage controls"}
              className="mt-3 flex flex-wrap items-center justify-center gap-2"
            >
              {stageActions
                .filter((a) => !a.dangerGuard)
                .map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => void onDispatch(act.args)}
                    data-testid={`stage-hotspot-${act.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#84b8d1] bg-white/95 px-3 py-1.5 text-xs font-extrabold text-[#0c2444] shadow-xs transition hover:bg-[#eef9ff] disabled:opacity-50"
                  >
                    <MousePointerClick className="h-3.5 w-3.5 text-[#007875]" aria-hidden="true" />
                    <span>{mode === "simulation" ? act.shortHotspotLabel : act.label}</span>
                  </button>
                ))}
            </div>

            {/* Live server-confirmed state badges overlaid below diagram — ONLY reflects accepted server state */}
            <div
              aria-live="polite"
              className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs"
            >
              {subject === "chemistry" && (
                <>
                  <span className={`g1-tag ${state.apparatusConnected ? "g1-tag-green" : "bg-white"}`}>
                    {state.apparatusConnected
                      ? isTe
                        ? "✓ డెలివరీ ట్యూబ్ → సబ్బు ద్రావణం కనెక్ట్ చేయబడింది"
                        : "✓ Delivery tube → soap solution connected"
                      : isTe
                        ? "డెలివరీ ట్యూబ్ ఇంకా కనెక్ట్ కాలేదు"
                        : "Delivery tube not yet connected"}
                  </span>
                  {state.theoreticalH2Umol !== null && state.theoreticalH2Umol !== undefined && (
                    <span className="g1-tag g1-tag-blue">
                      {isTe
                        ? `నిర్ధారించిన H₂ గరిష్ట పరిమితి: ${state.theoreticalH2Umol} µmol (సైద్ధాంతికం)`
                        : `Confirmed H₂ upper bound: ${state.theoreticalH2Umol} µmol (theoretical)`}
                    </span>
                  )}
                </>
              )}

              {subject === "physics" && (
                <>
                  <span className={`g1-tag ${state.slabMounted ? "g1-tag-green" : "bg-white"}`}>
                    {state.slabMounted
                      ? isTe
                        ? "✓ గాజు దిమ్మె లంబానికి అనుగుణంగా అమర్చబడింది"
                        : "✓ Glass slab aligned to normal"
                      : isTe
                        ? "గాజు దిమ్మె ఇంకా అమర్చబడలేదు"
                        : "Slab not yet mounted"}
                  </span>
                  {state.refractedAngleDeg !== null && state.refractedAngleDeg !== undefined && (
                    <span className="g1-tag g1-tag-blue">
                      i = {state.incidentAngleDeg}° · r = {state.refractedAngleDeg}° ·{" "}
                      {isTe ? "విస్థాపనం" : "offset"} = {state.transverseOffsetMm} mm
                    </span>
                  )}
                </>
              )}

              {subject === "biology" && (
                <>
                  <span className={`g1-tag ${state.slideLoaded ? "g1-tag-green" : "bg-white"}`}>
                    {state.slideLoaded
                      ? isTe
                        ? `✓ ఫీల్డ్ ${state.selectedField ?? 0} · ప్లేన్ ${state.acquiredPlane ?? 0}`
                        : `✓ Field ${state.selectedField ?? 0} · Plane ${state.acquiredPlane ?? 0}`
                      : isTe
                        ? "స్లైడ్ ఇంకా ఎంచుకోబడలేదు"
                        : "Slide not yet selected"}
                  </span>
                  {state.annotatedStructures && state.annotatedStructures.length > 0 && (
                    <span className="g1-tag g1-tag-blue">
                      {isTe ? "గుర్తించినవి: " : "Marked: "}
                      {state.annotatedStructures.join(", ")}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Accessible Equipment List slide-up panel */}
        {showEquipmentDrawer && !domAccessibleMode && (
          <div
            role="region"
            aria-label={isTe ? "అందుబాటులో ఉండే పరికరాల జాబితా" : "Accessible equipment list"}
            className="relative z-20 mb-3 max-h-[240px] overflow-y-auto rounded-2xl border border-[#b9d8ec] bg-white p-4 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0c2444]">
                {isTe
                  ? `పరికరాలు & భద్రతా తనిఖీ చర్యలు (${definition.requiredApparatus.length} పరికరాలు)`
                  : `Equipment & Guard Actions (${definition.requiredApparatus.length} items)`}
              </h3>
              <button
                type="button"
                onClick={() => setShowEquipmentDrawer(false)}
                className="text-xs font-bold text-[#007875] hover:underline"
              >
                {isTe ? "మూసివేయి" : "Close"}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {stageActions.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => void onDispatch(act.args)}
                  className={`flex items-start gap-2 rounded-xl border p-2.5 text-left text-xs font-semibold transition-colors ${
                    act.dangerGuard
                      ? "border-[#f3d1c9] bg-[#fff9f8] text-[#912018] hover:bg-[#fef3f2]"
                      : "border-[#d8e8f2] bg-[#f8fcff] text-[#0c2444] hover:bg-[#e8f5ff]"
                  }`}
                  data-testid={`equip-action-${act.id}`}
                >
                  {act.dangerGuard ? (
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#007875]" aria-hidden="true" />
                  )}
                  <span>{act.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom stage toolbar matching 03_Simulation_Player_Premium.png */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setViewZoom(1);
              setShowEquipmentDrawer(false);
            }}
            className="g1-btn g1-btn-outline min-h-[38px] bg-white px-2.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{dict.player.resetView}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDomAccessibleMode(false);
              setShowEquipmentDrawer((v) => !v);
            }}
            aria-expanded={showEquipmentDrawer}
            className="g1-btn g1-btn-outline min-h-[38px] bg-white px-2.5 text-xs"
            data-testid="toggle-equipment-list"
          >
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{dict.player.equipmentList}</span>
          </button>
          <button
            type="button"
            onClick={() => setDomAccessibleMode((v) => !v)}
            aria-pressed={domAccessibleMode}
            className="g1-btn g1-btn-outline min-h-[38px] bg-white px-2.5 text-xs"
            data-testid="toggle-dom-mode"
          >
            {domAccessibleMode ? (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Accessibility className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {domAccessibleMode ? dict.player.canvasViewMode : dict.player.accessibleDomMode}
            </span>
          </button>
        </div>

        {/* Truthful stage save badge (never claims saved when offline/unsaved intent exists — W05) */}
        <span
          className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-mono text-xs font-extrabold ${
            isOffline || hasUnsavedIntent
              ? "border border-[#f5d5a3] bg-[#fff4d7] text-[#805100]"
              : "bg-[#e5f9ef] text-[#046c49]"
          }`}
          data-testid="stage-save-pill"
        >
          <span>{isOffline || hasUnsavedIntent ? "⚠" : "✓"}</span>
          <span>
            {isOffline || hasUnsavedIntent
              ? isTe
                ? `ఆఫ్‌లైన్ · చివరి రివిజన్ ${revision}`
                : `Offline · Last confirmed rev ${revision}`
              : isTe
                ? `సేవ్ చేయబడిన రివిజన్ ${revision}`
                : `Saved rev ${revision}`}
          </span>
        </span>
      </div>
    </div>
  );
}
