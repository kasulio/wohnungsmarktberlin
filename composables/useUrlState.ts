import { type ZodNullable, type ZodObject, type ZodOptional, z } from "zod";
import { berlinDistricts } from "~/data/districts";
import { propertyManagementConfigs } from "~/data/propertyManagements/configs";
import { tags } from "~/data/tags";

export const useUrlState = <
	TSchema extends ZodObject<Record<string, ZodNullable<ZodOptional<any>>>>,
>(
	schema: TSchema,
) => {
	const { currentRoute, push, replace } = useRouter();

	const updateQueryState = (
		state: Partial<TSchema["_input"]>,
		useReplace = false,
	) => {
		const res = schema.safeParse(state);
		if (!res.success) {
			console.error(res.error);
			return;
		}
		const func = useReplace ? replace : push;
		const newQuery = Object.entries(res.data).reduce(
			(acc, [key, value]) => {
				acc[key] = value ?? undefined;
				return acc;
			},
			{ ...currentRoute.value.query },
		);

		func({
			query: newQuery,
		});
	};

	// reset all query params, that are in the schema
	const resetQueryState = () => {
		const keys = Object.keys(schema.shape);
		const query = omit(currentRoute.value.query, keys);
		push({
			query,
		});
	};

	const urlState = computed((): TSchema["_output"] => {
		const query = Object.entries(currentRoute.value.query).reduce(
			(acc, [key, value]) => {
				acc[key] = Array.isArray(value) ? value : [value];
				return acc;
			},
			{} as Record<string, unknown[]>,
		);

		const res = schema.safeParse(query);
		if (res.success) {
			return res.data;
		}
		return {};
	});

	return {
		updateQueryState,
		resetQueryState,
		urlState,
	};
};

const paginationSchema = z.object({
	page: z.coerce.number().array().length(1).optional().nullable(),
	pageSize: z.coerce.number().array().length(1).optional().nullable(),
});

export const usePaginationUrlState = () => {
	return useUrlState(paginationSchema);
};

export const flatFilterUrlSchema = z
	.object({
		ids: z.array(z.string()).optional().nullable(),
		tags: z.array(z.string()).optional().nullable(),
		propertyManagements: z.array(z.string()).optional().nullable(),
		districts: z.array(z.string()).optional().nullable(),
		priceMin: z.array(z.coerce.number()).optional().nullable(),
		priceMax: z.array(z.coerce.number()).optional().nullable(),
		roomsMin: z.array(z.coerce.number()).optional().nullable(),
		roomsMax: z.array(z.coerce.number()).optional().nullable(),
		areaMin: z.array(z.coerce.number()).optional().nullable(),
		areaMax: z.array(z.coerce.number()).optional().nullable(),
		orderBy: z
			.array(
				z.enum([
					"main",
					"price",
					"usableArea",
					"roomCount",
					"rentPricePerSquareMeter",
				]),
			)
			.optional()
			.nullable(),
		order: z
			.array(z.enum(["asc", "desc"]))
			.optional()
			.nullable(),
	})
	.extend(paginationSchema.shape);

export const useFlatFilterUrlState = () => {
	const url = useUrlState(flatFilterUrlSchema);

	const validTags = url.urlState.value.tags?.filter((tag) =>
		typedObjectKeys(tags).includes(tag),
	);
	const validDistricts = url.urlState.value.districts?.filter(
		(district) => district in berlinDistricts,
	);

	const validPropertyManagements =
		url.urlState.value.propertyManagements?.filter(
			(slug) => slug in propertyManagementConfigs,
		);

	const validQueryState = {
		...url.urlState.value,
		tags: validTags,
		districts: validDistricts,
		propertyManagements: validPropertyManagements,
	};

	if (JSON.stringify(validQueryState) !== JSON.stringify(url.urlState.value)) {
		url.updateQueryState(validQueryState, true);
	}

	return url;
};
