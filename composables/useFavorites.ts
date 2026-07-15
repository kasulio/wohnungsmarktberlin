import { z } from "zod";
import type { ListingFlat } from "~/types/listing-flat";

const { set, state: favoritesIds } = useLocalStorage(
  "favorites",
  z.array(z.string()),
  [],
);

export const useFavorites = () => {
  const { $client } = useNuxtApp();

  const favoritesQuery = $client.flat.getAll.useQuery(
    computed(() => ({
      ids: favoritesIds.value,
    })),
    {
      transform: (res): ListingFlat[] => res.data,
    },
  );

  watch(favoritesQuery.data, (favoritesData) => {
    // filter out deleted flats
    if (favoritesData && favoritesData?.length !== favoritesIds.value.length) {
      // TODO: maybe show change in snackbar
      set(favoritesData?.map((flat) => flat.id) ?? []);
    }
  });

  return {
    remove: (id: string) => {
      const newFavoritesIds = favoritesIds.value.filter(
        (favoriteId: string) => favoriteId !== id,
      );
      set(newFavoritesIds);
    },
    add: (id: string) => {
      const newFavorites = Array.from(new Set([...favoritesIds.value, id]));
      set(newFavorites);
    },
    set,
    favoritesIds,
    favorites: favoritesQuery.data,
  };
};

export const useFavorite = (id: MaybeRefOrGetter<string>) => {
  const resolvedId = computed(() => toValue(id));

  const add = () => {
    const flatId = resolvedId.value;
    const newFavorites = Array.from(new Set([...favoritesIds.value, flatId]));
    set(newFavorites);
  };

  const remove = () => {
    const flatId = resolvedId.value;
    const newFavorites = favoritesIds.value.filter(
      (favoriteId: string) => favoriteId !== flatId,
    );
    set(newFavorites);
  };

  const toggle = () => {
    if (favoritesIds.value.includes(resolvedId.value)) {
      remove();
    } else {
      add();
    }
  };

  const isFavorite = computed(() => {
    return favoritesIds.value.includes(resolvedId.value);
  });

  return {
    add,
    toggle,
    remove,
    isFavorite,
    favorites: favoritesIds,
  };
};
