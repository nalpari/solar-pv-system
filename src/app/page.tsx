"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Lnb } from "./components/lnb/lnb";
import type { SimulationFormState } from "./types";
import type { SimulationInput } from "@/lib/qsp/schema";
import RoofEditToolbar from "./components/RoofEditToolbar";
import type { RoofTool } from "./components/RoofEditToolbar";
import MapView from "./components/MapView";
import { placePanels, placePanelsOnCanvasCm } from "./utils/panelPlacement";
import { t } from "./utils/i18n";
import { extractPostalCode } from "./utils/postalCode";
import type { Lang } from "./utils/i18n";
import CropPopup, { type CropPopupHandle } from "./components/CropPopup";
import AiDetectControls from "./components/AiDetectControls";
import { detectRoofs } from "./utils/aiDetect";
import type { NormalizedPolygon } from "./utils/aiDetect";
import type {
  PanelSize,
  PanelOrientation,
  DrawingMode,
  CropData,
  PolygonArea,
  PlacedPanel,
  PixelPanel,
  PixelPolygon,
} from "./types";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const DEFAULT_CENTER = { lat: 35.6850697, lng: 139.7619073 }; // 〒100-0005 東京都千代田区丸の内1-1-1
const DEFAULT_SLOPE: number | null = null; // 미선택 상태로 시작
const DEFAULT_PANEL_SIZE: PanelSize | null = null; // 모듈 미선택 상태로 시작

// 발전시뮬 입력 폼 기본값 — 초기 상태이자 "모듈 편집으로 돌아가기" 시 초기화 기준
const DEFAULT_SIM_FORM: SimulationFormState = {
  azimuth: "",
  hasBattery: true,
  batteryModel: "",
  monthlyElecCost: "",
};

type SidebarTab = "design" | "simulation";

const GAP_X_CM = 0.3; // 모듈 간격 좌우 3mm (처마 평행)
const GAP_Y_CM = 3; // 모듈 간격 상하 30mm (처마 수직)
const MARGIN_CM = 30; // 외곽 여백 300mm

// 발전시뮬 결과조회 입력 매핑 (docs/qsp-api/05)
const ROOF_LOC_CD: Record<string, number> = {
  N: 1, NE: 3, E: 5, SE: 7, S: 9, SW: 11, W: 13, NW: 15, // 16방위 중 앱 8방위(홀수 코드)
};
// 지붕경사 寸 → 度 (예: 4寸 → 21.8°)
function sunToDegree(sun: number): number {
  return Math.round((Math.atan(sun / 10) * 180 / Math.PI) * 10) / 10;
}

// 발전시뮬 입력(SimulationInput) 조립 — UI state 를 musbi 파라미터로 매핑
function buildSimulationInput(args: {
  postCd: string;
  moduleId: string;
  panelCount: number;
  roofCnt: number;
  azimuth: string;
  slope: number | null;
  monthlyElecCost: string;
  hasBattery: boolean;
  batteryModel: string;
}): SimulationInput {
  return {
    pvSimulationYn: "Y",
    postCd: args.postCd,
    moduleItemId: args.moduleId,
    moduleCnt: args.panelCount,
    roofCnt: args.roofCnt,
    roofLocCd: ROOF_LOC_CD[args.azimuth] ?? 0,
    roofSlopeCd: sunToDegree(args.slope ?? 0),
    avrgMnthElctBill: Number(args.monthlyElecCost) || 0,
    batteryItemId: args.hasBattery ? args.batteryModel : "",
    storageBatteryYn: args.hasBattery ? "Y" : "N",
    storageBatterySelectYn: args.hasBattery ? "Y" : "N",
  };
}

export default function Home() {
  const [lang] = useState<Lang>("ja");
  const [activeTab, setActiveTab] = useState<SidebarTab>("design");
  // 모듈 배치 완료(편집 잠금) 상태 — true면 지붕 편집·경사·모듈/배치 비활성, 발전시뮬 버튼 활성
  const [isPlacementDone, setIsPlacementDone] = useState(false);
  // 결과조회 처리(정합성 확인 → 이미지 저장 → 조회/리다이렉트) 진행 중 — 중복 클릭 방지 + 로딩 오버레이
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 주소검색 선택 후 사용자가 지도를 드래그로 이동했는지 — 우편번호 출처 결정용
  // (이동 X + 검색우편 있음 → 재사용으로 절감 / 그 외 → 크롭중심 reverse geocode)
  const [mapMoved, setMapMoved] = useState(false);
  const [slope, setSlope] = useState<number | null>(DEFAULT_SLOPE);
  const [roofEditTool, setRoofEditTool] = useState<RoofTool>("select");
  const [simForm, setSimForm] = useState<SimulationFormState>(DEFAULT_SIM_FORM);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // AI 지붕 감지 상태 (Phase 7: 수동 트리거 + 상태 머신)
  // 실패는 alert으로만 표시 (D10/H-2: 배너 제거) → detectError state 불필요
  const [detectStatus, setDetectStatus] = useState<"idle" | "detecting">("idle");
  const [aiSeedAreas, setAiSeedAreas] = useState<NormalizedPolygon[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cropRafRef = useRef<number | null>(null);

  // detect useEffect 의존성에서 lang 제거 (I-5: 사용자 토글 시 재호출 방지)
  // 단 catch 시점의 메시지는 latest lang으로 보여야 하므로 ref로 read
  const langRef = useRef(lang);
  const cropPopupRef = useRef<CropPopupHandle>(null);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const [center, setCenter] = useState(DEFAULT_CENTER);

  // 마운트 시 1회: 브라우저 geolocation 권한 요청 → 허용 시 현재 위치로 지도 이동,
  // 거부/실패 시 기본값(마루노우치) 유지. 권한 결과는 어디에도 저장하지 않으며 (브라우저가 자체 관리),
  // 매 접속(마운트)마다 getCurrentPosition을 호출한다. 사용자가 주소를 선택한 후 응답이
  // 늦게 도착하면 무시 (race 가드)
  const userOverrodeRef = useRef(false);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled || userOverrodeRef.current) return;
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // 권한 거부 / 디바이스 위치 비활성 / 타임아웃 — silent fallback (기본값 유지)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const [viewport, setViewport] = useState<google.maps.LatLngBounds | null>(null);
  const [cropMode, setCropMode] = useState(false);
  // 좌측 사이드바 건물확정 버튼 재클릭(2차) 시 증가 — MapView/CropOverlay가 watch해서 그려진 영역으로 확정
  const [confirmCropSignal, setConfirmCropSignal] = useState(0);
  const [cropData, setCropData] = useState<CropData | null>(null);
  const [address, setAddress] = useState("");
  // 주소검색 결과 우편번호 — 지도 미이동 시 postCd 로 재사용(geocoding 비용 절감)
  const [searchedPostalCode, setSearchedPostalCode] = useState("");
  // drawingMode는 roofEditTool에서 파생 (drawRoof → install, drawOpening → exclude, 그 외 → null)
  const [undoSignal, setUndoSignal] = useState(0);
  const [clearSignal, setClearSignal] = useState(0);
  const [deleteSelectedSignal, setDeleteSelectedSignal] = useState(0);
  const [selectedRoofIds, setSelectedRoofIds] = useState<string[]>([]);
  const [areas, setAreas] = useState<PolygonArea[]>([]);
  const [panelSize, setPanelSize] = useState<PanelSize | null>(DEFAULT_PANEL_SIZE);
  // 선택 모듈 matlCd (SimulationInput.moduleItemId) — 시뮬 API 입력용
  const [moduleId, setModuleId] = useState<string>("");
  const [placedPanelsList, setPlacedPanelsList] = useState<PlacedPanel[]>([]);
  const [pixelAreas, setPixelAreas] = useState<{ areas: PixelPolygon[]; metersPerPixel: number } | null>(null);
  const [placedPixelPanels, setPlacedPixelPanels] = useState<PixelPanel[]>([]);
  const [placementError, setPlacementError] = useState<string | null>(null);

  const installAreas = areas.filter((a) => a.type === "install");
  const excludeAreas = areas.filter((a) => a.type === "exclude");

  // RoofEditToolbar의 활성 툴에서 CropPopup의 drawingMode를 파생
  const drawingMode: DrawingMode =
    roofEditTool === "drawRoof"
      ? "install"
      : roofEditTool === "drawOpening"
        ? "exclude"
        : null;

  function handlePlaceSelect(location: {
    lat: number;
    lng: number;
    address: string;
    postalCode?: string;
    viewport?: google.maps.LatLngBounds;
  }) {
    userOverrodeRef.current = true; // 사용자가 명시적으로 위치 선택 — 늦게 도착한 geolocation 응답 무시
    setCenter({ lat: location.lat, lng: location.lng });
    setAddress(location.address);
    setSearchedPostalCode(location.postalCode ?? "");
    setMapMoved(false); // 새 주소 선택 → 이동 플래그 리셋
    setViewport(location.viewport ?? null);
  }

  const handleCropComplete = useCallback((data: CropData) => {
    setCropData(data);
    setCropMode(false);
    const center = {
      lat: (data.bounds.sw.lat + data.bounds.ne.lat) / 2,
      lng: (data.bounds.sw.lng + data.bounds.ne.lng) / 2,
    };
    // 팝업이 지도를 완전히 가린 다음 프레임에 센터 이동 — panTo 애니메이션이
    // 팝업 뜨기 전에 보여서 깜박이는 현상 방지. viewport도 함께 해제하여
    // ViewUpdater가 fitBounds 대신 panTo(center)로 분기하도록 한다.
    cropRafRef.current = requestAnimationFrame(() => {
      cropRafRef.current = null;
      setViewport(null);
      setCenter(center);
    });
  }, []);

  // 언마운트 시 예약된 crop 센터 이동 rAF 취소
  useEffect(() => {
    return () => {
      if (cropRafRef.current !== null) cancelAnimationFrame(cropRafRef.current);
    };
  }, []);

  // 크롭 변경 시 AI 분석 상태 reset (Phase 7: 자동 트리거 제거, 사용자 핸들러로 분리)
  useEffect(() => {
    if (!cropData) {
      setAiSeedAreas([]);
      setDetectStatus("idle");
      return;
    }
    // 새 cropData 진입 = idle 상태로 시작 (분석은 사용자 "AI 분석 시작" 클릭으로)
    setDetectStatus("idle");
    setAiSeedAreas([]);
    return () => {
      // F-1 유지: cropData 교체 시 진행 중 fetch + 이전 폴리곤/패널 정리
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setAreas([]);
      setPixelAreas(null);
      setPlacedPixelPanels([]);
      setPlacedPanelsList([]);
    };
  }, [cropData]);

  // areas의 latest snapshot (M-1: handleStartDetect deps에서 areas.length 제거)
  const areasRef = useRef(areas);
  useEffect(() => {
    areasRef.current = areas;
  }, [areas]);

  // AI 분석 시작 핸들러 (Phase 7: 수동 트리거)
  const handleStartDetect = useCallback(async () => {
    if (!cropData) return;

    // D8/Mi-7: 이미 지붕면이 있으면 재분석 확인 + handleDeleteAll 재사용으로 일괄 초기화
    if (areasRef.current.length > 0) {
      const ok = window.confirm(t("aiDetectConfirmReanalyze", langRef.current));
      if (!ok) return;
      handleDeleteAll();
      setAiSeedAreas([]);
      // 재분석 시 경사/모듈/배치 방향도 기본값으로 초기화
      setSlope(DEFAULT_SLOPE);
      setPanelSize(DEFAULT_PANEL_SIZE);
      setIsPlacementDone(false); // 배치 완료(편집 잠금) 상태 해제
    }

    // 이전 진행 중 요청 정리
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setDetectStatus("detecting");

    try {
      const response = await detectRoofs(cropData, controller.signal);
      if (controller.signal.aborted) return;
      // H-1: 새 controller가 시작됐다면 stale 응답 무시 (race 가드)
      if (abortControllerRef.current !== controller) return;
      setAiSeedAreas(response.polygons.map((p) => p.points));
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === "AbortError") return;
      // D10/H-2: 실패 alert만 (배너 제거 — 기획서 명시 문구)
      window.alert(t("aiDetectFailedAlert", langRef.current));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (!controller.signal.aborted) {
        setDetectStatus("idle");
      }
    }
  }, [cropData]);

  // AI 분석 취소 핸들러 (Phase 7: 사용자 취소 버튼)
  const handleCancelDetect = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setDetectStatus("idle");
  }, []);

  const handleAreasChange = useCallback((newAreas: PolygonArea[]) => {
    const validIds = new Set(newAreas.map((a) => a.id));
    setAreas(newAreas);
    // 없어진 폴리곤에 속한 패널만 제거 (살아있는 폴리곤 패널은 유지)
    setPlacedPanelsList((prev) => prev.filter((p) => validIds.has(p.polygonId)));
  }, []);

  const handlePixelAreasChange = useCallback((areas: PixelPolygon[], metersPerPixel: number) => {
    const validIds = new Set(areas.map((a) => a.id));
    setPixelAreas({ areas, metersPerPixel });
    // 없어진 폴리곤에 속한 패널만 제거
    setPlacedPixelPanels((prev) => prev.filter((p) => validIds.has(p.polygonId)));
  }, []);

  const handleCropClose = useCallback(() => {
    setCropData(null);
    setRoofEditTool("select");
    setAreas([]);
    setPixelAreas(null);
    setPlacedPixelPanels([]);
    setPlacedPanelsList([]);
    setIsPlacementDone(false); // 배치 완료(편집 잠금) 상태 해제
    // 좌측메뉴 입력 초기화 (주소검색 데이터 address/center/searchedPostalCode 는 유지)
    setSlope(DEFAULT_SLOPE);
    setPanelSize(DEFAULT_PANEL_SIZE);
    setModuleId("");
    setSimForm(DEFAULT_SIM_FORM);
    setActiveTab("design");
    setPlacementError(null);
    // AI 감지 state는 cropData가 null 되면 detect useEffect가 자동 정리함 (I-4: DRY)
  }, []);

  /** 지붕편집 툴바의 "전체 삭제" 액션 - 그려진 폴리곤/패널만 초기화 (cropData 유지) */
  function handleDeleteAll() {
    setAreas([]);
    setPlacedPanelsList([]);
    setPixelAreas(null);
    setPlacedPixelPanels([]);
    setRoofEditTool("select");
    // CropPopup 내부 areas state도 함께 비우도록 신호
    setClearSignal((n) => n + 1);
  }

  // 무조건 전체 모듈 삭제 (모듈 변경 시 사용 — 선택 여부 무관)
  function clearAllPanels() {
    setPlacedPanelsList([]);
    setPlacedPixelPanels([]);
  }

  function handleDeleteAllPanels() {
    if (selectedRoofIds.length > 0) {
      // 선택된 지붕면 위 모듈만 삭제
      setPlacedPanelsList((prev) => prev.filter((p) => !selectedRoofIds.includes(p.polygonId)));
      setPlacedPixelPanels((prev) => prev.filter((p) => !selectedRoofIds.includes(p.polygonId)));
    } else {
      // 선택 없음 → 전체 모듈 삭제
      clearAllPanels();
    }
  }

  /** 특정 폴리곤의 처마 기준선이 변경되면 해당 폴리곤 위 패널만 삭제 */
  const handleEaveChange = useCallback((polygonId: string) => {
    setPlacedPanelsList((prev) => prev.filter((p) => p.polygonId !== polygonId));
    setPlacedPixelPanels((prev) => prev.filter((p) => p.polygonId !== polygonId));
  }, []);

  function switchToSimulation() {
    setCropMode(false);
    setRoofEditTool("select");
    setActiveTab("simulation");
  }

  // 지도 센터좌표 → 우편번호 (reverse geocoding) — 지도 이동 시에만 호출
  async function geocodePostalCode(loc: { lat: number; lng: number }): Promise<string> {
    try {
      const { results } = await new google.maps.Geocoder().geocode({ location: loc });
      return extractPostalCode(results?.[0]?.address_components);
    } catch {
      return "";
    }
  }

  // 합성 레이아웃 이미지(배경+패널)를 S3(/api/image/upload)에 업로드 → fileName 반환 (실패 시 null)
  async function uploadLayoutImage(): Promise<string | null> {
    const blob = await cropPopupRef.current?.getLayoutBlob();
    if (!blob) return null; // 캔버스 없음 — 재시도 무의미
    const fd = new FormData();
    fd.append("file", blob, "layout.png");
    // fetch만 최대 3회 재시도 (A-2: 다 실패하면 호출부에서 중단)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch("/api/image/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (json.success) return json.data.fileName as string;
        // 4xx 는 결정적 실패(빈 파일·10MB 초과 등) — 재시도 무의미, 즉시 중단
        if (res.status >= 400 && res.status < 500) return null;
      } catch {
        // 네트워크 예외 — 재시도
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 500)); // 지수 백오프
    }
    return null;
  }

  // 결과조회 제출 — 우편번호 결정 → 정합성 검증 → 이미지 저장 → calcResults 리다이렉트
  async function handleSimSubmit() {
    if (isSubmitting) return; // 중복 클릭 방지
    setIsSubmitting(true);
    try {
      // 우편번호: 이동X+검색우편 있으면 재사용, 그 외(검색우편 없음 포함) 크롭중심 geocode
      const postCd =
        !mapMoved && searchedPostalCode
          ? searchedPostalCode
          : await geocodePostalCode(center);
      if (!postCd) {
        alert(t("postCdMissing", lang));
        setIsSubmitting(false);
        return;
      }
      const input = buildSimulationInput({
        postCd,
        moduleId,
        panelCount,
        roofCnt: installAreas.length,
        azimuth: simForm.azimuth,
        slope,
        monthlyElecCost: simForm.monthlyElecCost,
        hasBattery: simForm.hasBattery,
        batteryModel: simForm.batteryModel,
      });
      // ① 정합성 검증 + 조회 URL 취득 (실패 시 alert 후 중단)
      const res = await fetch("/api/musbi/sim-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message ?? t("simCheckFailed", lang));
        setIsSubmitting(false);
        return;
      }
      if (!json.data?.redirectUrl) {
        alert(t("submitFailed", lang));
        setIsSubmitting(false);
        return;
      }
      // ② 합성 이미지 S3 업로드 (4xx 즉시중단·5xx 재시도)
      const fileName = await uploadLayoutImage();
      if (!fileName) {
        alert(t("imageUploadFailed", lang));
        setIsSubmitting(false);
        return;
      }
      // ③ calcResults 페이지로 리다이렉트 (roofImgSrc 부착) — 성공 시 페이지를 떠남
      const roofImgName = fileName.replace(/^pvmap\//, "");
      window.location.href = `${json.data.redirectUrl}&roofImgSrc=${encodeURIComponent(roofImgName)}`;
    } catch {
      // 네트워크 단절 등 예외 — 사용자 피드백 후 로딩 해제
      alert(t("submitFailed", lang));
      setIsSubmitting(false);
    }
  }

  function handlePlacePanels(layout: "aligned" | "staggered" = "aligned") {
    setPlacementError(null);
    // 경사·모듈 미선택 시 배치 불가 (UI 비활성화에 더해 함수 레벨 방어)
    if (slope === null || !panelSize) return;
    // 패널 긴 변을 처마 기준선과 평행하게 — landscape 고정 (명세)
    const ori: PanelOrientation = "landscape";

    if (pixelAreas) {
      try {
        const { areas: pxAreas, metersPerPixel } = pixelAreas;
        const installPx = pxAreas.filter((a) => a.type === "install");
        const excludePx = pxAreas.filter((a) => a.type === "exclude");

        const panels = placePanelsOnCanvasCm(
          installPx, excludePx,
          panelSize.width, panelSize.height,
          ori, layout, GAP_X_CM, GAP_Y_CM, MARGIN_CM, metersPerPixel, slope ?? 0,
        );

        setPlacedPixelPanels(panels);
      } catch (e) {
        console.error("Panel placement failed:", e);
        setPlacementError(t("panelPlacementFailed", lang));
      }
    } else {
      try {
        const panels = placePanels(
          installAreas, excludeAreas,
          panelSize, ori, layout,
          GAP_X_CM * 10, GAP_Y_CM * 10, MARGIN_CM * 10, slope ?? 0,
        );

        setPlacedPanelsList(panels);
      } catch (e) {
        console.error("Panel placement failed:", e);
        setPlacementError(t("panelPlacementFailed", lang));
      }
    }
  }

  const canPlace = slope !== null && panelSize !== null && (cropData !== null
    ? pixelAreas !== null && pixelAreas.areas.some((a) => a.type === "install")
    : installAreas.length > 0);

  const panelCount = placedPixelPanels.length || placedPanelsList.length;

  // 발전시뮬 결과조회 필수값(사양 Not Null) 충족 여부 — postCd 는 onSubmit 에서 geocode 후 검증
  const canSubmitSim =
    moduleId !== "" &&
    slope !== null &&
    panelCount > 0 &&
    installAreas.length > 0 &&
    simForm.azimuth !== "" &&
    simForm.monthlyElecCost !== "" &&
    (!simForm.hasBattery || simForm.batteryModel !== "");

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      libraries={["places", "geometry"]}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        {/* Left Sidebar — pv-pub design */}
        <Lnb
          tab={activeTab}
          lang={lang}
          design={{
            onPlaceSelect: handlePlaceSelect,
            cropMode,
            cropPopupOpen: cropData !== null,
            // 1차 클릭: 크롭모드 활성화 / 2차 클릭(이미 활성): 확정 signal 증가 (MapView가 영역 있으면 확정 처리)
            onCropModeToggle: () => {
              if (cropMode) setConfirmCropSignal((n) => n + 1);
              else setCropMode(true);
            },
            slope,
            onSlopeChange: setSlope,
            areaCount: areas.length,
            panelSize,
            onPanelSizeChange: setPanelSize,
            onModuleSelect: setModuleId,
            panelCount,
            canPlace,
            placementError,
            onPlacePanels: handlePlacePanels,
            onDeleteAllPanels: handleDeleteAllPanels,
            onClearAllPanels: clearAllPanels,
            detectStatus,
            isPlacementDone,
            onPlacementDone: () => setIsPlacementDone((v) => !v),
            onSwitchToSimulation: switchToSimulation,
          }}
          sim={{
            formState: simForm,
            canSubmit: canSubmitSim,
            onFormChange: setSimForm,
            onGoBack: () => {
              // 입력값이 기본값에서 변경된 경우 초기화 컨펌, 기본값이면 즉시 이동
              // DEFAULT_SIM_FORM 과 shallow-equal — 기본값이 바뀌어도 판정이 자동 추종
              const pristine = (
                Object.keys(DEFAULT_SIM_FORM) as (keyof SimulationFormState)[]
              ).every((key) => simForm[key] === DEFAULT_SIM_FORM[key]);
              if (!pristine && !window.confirm(t("simBackToDesignConfirm", lang)))
                return;
              setSimForm(DEFAULT_SIM_FORM);
              setActiveTab("design");
              setIsPlacementDone(false);
            },
            onSubmit: handleSimSubmit,
          }}
        />

        {/* Map Area */}
        <main style={{ flex: 1, position: "relative" }}>
          {GOOGLE_MAPS_API_KEY ? (
            <MapView
              center={center}
              viewport={viewport}
              cropMode={cropMode}
              locked={cropData !== null}
              onCropComplete={handleCropComplete}
              onCropCancel={() => setCropMode(false)}
              confirmCropSignal={confirmCropSignal}
              address={address}
              lang={lang}
              onUserDrag={() => setMapMoved(true)}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-primary)",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 480,
                  padding: 32,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-tertiary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 8,
                  }}
                >
                  {t("apiKeyRequired", lang)}
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    marginBottom: 20,
                  }}
                >
                  {t("apiKeyDescription", lang)}
                </p>
                <code
                  style={{
                    display: "block",
                    padding: "12px 16px",
                    background: "var(--bg-surface)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-primary)",
                    fontSize: 13,
                    fontFamily: "var(--font-geist-mono)",
                    color: "var(--accent-blue-hover)",
                    textAlign: "left",
                    overflowX: "auto",
                  }}
                >
                  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
                </code>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    marginTop: 12,
                  }}
                >
                  {t("requiredApis", lang)}
                </p>
              </div>
            </div>
          )}
          {cropData && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 100,
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <RoofEditToolbar
                lang={lang}
                activeTool={roofEditTool}
                onToolChange={setRoofEditTool}
                onAction={(action) => {
                  if (action === "undo") {
                    setUndoSignal((n) => n + 1);
                  } else if (action === "deleteAll") {
                    handleDeleteAll();
                  } else if (action === "deleteSelected") {
                    setDeleteSelectedSignal((n) => n + 1);
                  } else if (action === "complete") {
                    // 작성 완료 → 선택/이동 모드로 자동 전환
                    setRoofEditTool("select");
                  }
                }}
                hasSelection={selectedRoofIds.length > 0}
                disabled={isPlacementDone}
              />
              <CropPopup
                ref={cropPopupRef}
                cropData={cropData}
                drawingMode={drawingMode}
                onAreasChange={handleAreasChange}
                onPixelAreasChange={handlePixelAreasChange}
                placedPanels={placedPixelPanels}
                onClose={handleCropClose}
                lang={lang}
                roofEditTool={roofEditTool}
                editLocked={isPlacementDone}
                onEaveChange={handleEaveChange}
                undoSignal={undoSignal}
                clearSignal={clearSignal}
                deleteSelectedSignal={deleteSelectedSignal}
                onSelectionChange={setSelectedRoofIds}
                initialAreas={aiSeedAreas}
                detectStatus={detectStatus}
              />
              {/* AI 분석 트리거 — 팝업 박스 외부 하단 (RoofEditToolbar 와 대칭) */}
              <AiDetectControls
                detectStatus={detectStatus}
                onStartDetect={handleStartDetect}
                onCancelDetect={handleCancelDetect}
                lang={lang}
              />
            </div>
          )}
        </main>
      </div>
      {/* 결과조회 처리 중(정합성 확인 → 이미지 저장 → 조회/리다이렉트) 전체 화면 로딩 — 중복 클릭 차단 */}
      {isSubmitting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <span
            style={{
              width: 48,
              height: 48,
              border: "4px solid rgba(255,255,255,0.3)",
              borderTopColor: "var(--accent-blue)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              display: "inline-block",
            }}
            aria-hidden="true"
          />
        </div>
      )}
    </APIProvider>
  );
}
