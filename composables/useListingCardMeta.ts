import { zipCodeToDistrict } from "~/data/districts";
import type { ListingCardDetailProps } from "~/types/listing-flat";
import { formatArea, formatPrice, formatRoomCount } from "~/utils/util";

export function districtLabelFromZip(postalCode: string) {
  return zipCodeToDistrict[postalCode]?.name ?? "Unbekannt";
}

export function useListingCardMeta(props: ListingCardDetailProps) {
  const district = computed(
    () => zipCodeToDistrict[props.address.postalCode] ?? null,
  );

  const districtLabel = computed(() =>
    districtLabelFromZip(props.address.postalCode),
  );

  const firstSeenLabel = computed(() =>
    props.firstSeen.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  );

  const summaryLabel = computed(() => {
    const plz = props.address.postalCode;
    const loc = `${plz} ${districtLabel.value}`;
    return `${props.address.street} ${props.address.streetNumber}, ${loc}`;
  });

  const route = useRoute();

  const mapTo = computed(() => {
    const { page: _page, pageSize: _pageSize, ...filterQuery } = route.query;
    return {
      path: "/map",
      query: {
        ...filterQuery,
        flat: props.id,
      },
    };
  });

  const tableRows = computed(() => {
    const rows: { label: string; value: string }[] = [];
    const { street, streetNumber, postalCode } = props.address;
    const loc = `${postalCode} ${districtLabel.value}`;
    rows.push({ label: "Adresse", value: `${street} ${streetNumber}, ${loc}` });
    if (props.roomCount)
      rows.push({ label: "Zimmer", value: formatRoomCount(props.roomCount) });
    if (props.usableArea)
      rows.push({ label: "Fläche", value: formatArea(props.usableArea) });
    if (props.floor != null)
      rows.push({
        label: "Etage",
        value: props.floor === 0 ? "EG" : String(props.floor),
      });
    if (props.coldRentPrice)
      rows.push({
        label: "Kaltmiete",
        value: formatPrice(props.coldRentPrice),
      });
    if (props.warmRentPrice)
      rows.push({
        label: "Warmmiete",
        value: formatPrice(props.warmRentPrice),
      });
    if ((props.coldRentPrice || props.warmRentPrice) && props.usableArea)
      rows.push({
        label: "€/m²",
        value: `${props.coldRentPrice ? formatPrice(props.coldRentPrice / props.usableArea) : "-"} / ${props.warmRentPrice ? formatPrice(props.warmRentPrice / props.usableArea) : "-"}`,
      });
    rows.push({ label: "Gesehen am", value: firstSeenLabel.value });
    return rows;
  });

  return {
    district,
    districtLabel,
    firstSeenLabel,
    summaryLabel,
    mapTo,
    tableRows,
  };
}
