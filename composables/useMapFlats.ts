import { berlinCoordinates } from "~/data/coordinates";
import {
  hasMapCoordinates,
  type MapFlat,
  type MapFlatWithCoordinates,
} from "~/types/map-flat";

const TOOLTIP_OFFSET_X = 16;
const TOOLTIP_OFFSET_Y = -16;
const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT = 240;

export function useMapFlats() {
  const route = useRoute();
  const { urlState } = useFlatFilterUrlState();
  const { $client } = useNuxtApp();

  const preselectedFlatId = computed(() => {
    const flat = route.query.flat;
    if (typeof flat === "string") return flat;
    if (Array.isArray(flat)) return flat[0] ?? null;
    return null;
  });

  const queryParams = computed(() => ({
    ...urlState.value,
    pageSize: [1000],
    page: [1],
  }));

  const flatsQuery = $client.flat.getAll.useQuery(queryParams);

  const selectedFlat = ref<MapFlat | null>(null);
  const pinnedFlatId = ref<string | null>(null);
  const preselectDismissed = ref(false);
  const appliedPreselectId = ref<string | null>(null);
  const tooltipPos = ref({ x: 0, y: 0 });
  const mapContainer = ref<HTMLElement | null>(null);
  const mapCenter = ref(berlinCoordinates);
  const mapZoom = ref(11);
  const isTouch = ref(false);
  const preselectReady = ref(false);

  const mapFlats = computed((): MapFlatWithCoordinates[] =>
    (flatsQuery.data.value?.data ?? []).filter(hasMapCoordinates),
  );

  function findPreselectedFlat(): MapFlat | null {
    const id = preselectedFlatId.value;
    if (!id) return null;
    return flatsQuery.data.value?.data?.find((f) => f.id === id) ?? null;
  }

  function clearFlatQueryParam() {
    if (!preselectedFlatId.value) return;
    const query = { ...route.query };
    delete query.flat;
    navigateTo({ path: route.path, query }, { replace: true });
  }

  function isMarkerHighlighted(flatId: string) {
    if (selectedFlat.value) return selectedFlat.value.id === flatId;
    return pinnedFlatId.value === flatId;
  }

  function centerOnFlat(flat: MapFlat) {
    const { latitude, longitude } = flat.address ?? {};
    if (latitude != null && longitude != null) {
      mapCenter.value = { lat: latitude, lng: longitude };
      mapZoom.value = 15;
    }
  }

  function applyPreselectedFlat(flat: MapFlat) {
    pinnedFlatId.value = flat.id;
    selectedFlat.value = isTouch.value ? flat : null;
    centerOnFlat(flat);
    appliedPreselectId.value = flat.id;
  }

  onMounted(() => {
    isTouch.value = window.matchMedia("(pointer: coarse)").matches;
    preselectReady.value = true;
  });

  watch(preselectedFlatId, (id, prevId) => {
    if (id === prevId) return;
    preselectDismissed.value = false;
    appliedPreselectId.value = null;
    pinnedFlatId.value = null;
    selectedFlat.value = null;
  });

  watch(
    [
      preselectedFlatId,
      () => flatsQuery.data.value?.data,
      () => flatsQuery.status.value,
      preselectReady,
    ],
    () => {
      if (!preselectReady.value || preselectDismissed.value) return;
      const id = preselectedFlatId.value;
      if (!id || flatsQuery.status.value === "pending") return;
      const flat = findPreselectedFlat();
      if (!flat) {
        selectedFlat.value = null;
        pinnedFlatId.value = null;
        appliedPreselectId.value = null;
        clearFlatQueryParam();
        return;
      }
      if (appliedPreselectId.value === id) return;
      applyPreselectedFlat(flat);
    },
    { immediate: true },
  );

  function updateTooltipPos(event: MouseEvent) {
    if (!mapContainer.value) return;
    const rect = mapContainer.value.getBoundingClientRect();
    let x = event.clientX - rect.left + TOOLTIP_OFFSET_X;
    let y = event.clientY - rect.top + TOOLTIP_OFFSET_Y;

    if (x + TOOLTIP_WIDTH > rect.width) {
      x = event.clientX - rect.left - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X;
    }
    if (y + TOOLTIP_HEIGHT > rect.height) {
      y = rect.height - TOOLTIP_HEIGHT - 8;
    }
    if (y < 0) y = 8;

    tooltipPos.value = { x, y };
  }

  function onMarkerMouseEnter(flat: MapFlat, event: MouseEvent) {
    if (isTouch.value) return;
    selectedFlat.value = flat;
    updateTooltipPos(event);
  }

  function onMarkerMouseLeave() {
    if (isTouch.value) return;
    selectedFlat.value = null;
  }

  function onMapMouseMove(event: MouseEvent) {
    if (isTouch.value || !selectedFlat.value) return;
    updateTooltipPos(event);
  }

  function onMarkerClick(flat: MapFlat, event: MouseEvent) {
    if (!isTouch.value) {
      navigateTo(flat.url, { external: true, open: { target: "_blank" } });
      return;
    }
    if (selectedFlat.value?.id === flat.id) {
      navigateTo(flat.url, { external: true, open: { target: "_blank" } });
    } else {
      selectedFlat.value = flat;
      event.stopPropagation();
    }
  }

  function dismissCard() {
    selectedFlat.value = null;
    pinnedFlatId.value = null;
    if (!preselectedFlatId.value) return;
    preselectDismissed.value = true;
    clearFlatQueryParam();
  }

  return {
    flatsQuery,
    mapFlats,
    mapCenter,
    mapZoom,
    mapContainer,
    selectedFlat,
    isTouch,
    tooltipPos,
    isMarkerHighlighted,
    onMarkerClick,
    onMarkerMouseEnter,
    onMarkerMouseLeave,
    onMapMouseMove,
    dismissCard,
  };
}
