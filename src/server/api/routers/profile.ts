import { type Profile } from "@prisma/client";

import { z } from "zod";
import {
  createProfile,
  getDrinkTypes,
  getFoodTypes,
  getLanguages,
  getProfile,
  updateProfile,
} from "~/server/api/services/profile.service";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const createProfileValidator = z.object({
  familyName: z.string(),
  dateOfBirth: z.date(),
  photoUrl: z.string(),
  title: z.string(),
  neighbourhood: z.string(),
  description: z.string(),
  maximumPeople: z.number().min(0).max(6),
  isSmoking: z.boolean(),
  profileLanguages: z.array(
    z.object({
      id: z.number(), // Referencing existing Language IDs
    }),
  ),
  profileDrinks: z.array(
    z.object({
      id: z.number(), // Referencing existing Drink IDs
    }),
  ),
  profileFoodTypes: z.array(
    z.object({
      id: z.number(), // Referencing existing FoodType IDs
    }),
  ),
});

export const updateProfileValidator = z.object({
  id: z.number(),
  data: z.object({
    familyName: z.string().optional(),
    dateOfBirth: z.date().optional(),
    photoUrl: z.string().optional(),
    title: z.string().optional(),
    neighbourhood: z.string().optional(),
    description: z.string().optional(),
    maximumPeople: z.number().min(0).max(6).optional(),
    isSmoking: z.boolean().optional(),
    profileLanguages: z
      .array(
        z.object({
          id: z.number(), // Referencing existing Language IDs
        }),
      )
      .optional(),
    profileDrinks: z
      .array(
        z.object({
          id: z.number(), // Referencing existing Drink IDs
        }),
      )
      .optional(),
    profileFoodTypes: z
      .array(
        z.object({
          id: z.number(), // Referencing existing FoodType IDs
        }),
      )
      .optional(),
  }),
});

export const profileRouter = createTRPCRouter({
  createProfile: protectedProcedure
    .input(createProfileValidator)
    .mutation(async ({ ctx, input }): Promise<Profile> => {
      return createProfile(ctx, {
        ...input,
        createdById: ctx.session.user.id,
        profileLanguages: {
          create: input.profileLanguages.map((lang) => ({
            language: { connect: { id: lang.id } },
          })),
        },
        profileDrinks: {
          create: input.profileDrinks.map((drink) => ({
            drink: { connect: { id: drink.id } },
          })),
        },
        profileFoodTypes: {
          create: input.profileFoodTypes.map((food) => ({
            foodType: { connect: { id: food.id } },
          })),
        },
      });
    }),
  updateProfile: protectedProcedure
    .input(updateProfileValidator)
    .mutation(async ({ ctx, input }): Promise<void> => {
      const { id, data } = input;

      // Fetch the current profile with relations
      const existingProfile = await ctx.db.profile.findUnique({
        where: { id },
        include: {
          profileLanguages: true,
          profileDrinks: true,
          profileFoodTypes: true,
        },
      });

      if (!existingProfile) {
        throw new Error("Profile not found");
      }

      // Helper function to process many-to-many relations
      const processRelations = (
        existingIds: number[],
        updatedIds: number[],
      ) => {
        console.log(existingIds, updatedIds);

        const toConnect = updatedIds.filter((id) => !existingIds.includes(id));
        const toDisconnect = existingIds.filter(
          (id) => !updatedIds.includes(id),
        );

        return {
          toConnect: toConnect.length > 0 ? toConnect : undefined,
          toDisconnect: toDisconnect.length > 0 ? toDisconnect : undefined,
        };
      };

      // Process profileLanguages
      const profileLanguages = processRelations(
        existingProfile.profileLanguages.map((pl) => pl.languageId),
        data.profileLanguages?.map((pl) => pl.id) ?? [],
      );

      // Process profileDrinks
      const profileDrinks = processRelations(
        existingProfile.profileDrinks.map((pd) => pd.drinkId),
        data.profileDrinks?.map((pd) => pd.id) ?? [],
      );

      // Process profileFoodTypes
      const profileFoodTypes = processRelations(
        existingProfile.profileFoodTypes.map((pf) => pf.foodTypeId),
        data.profileFoodTypes?.map((pf) => pf.id) ?? [],
      );

      console.log(profileFoodTypes);

      // Update the profile
      await ctx.db.profile.update({
        where: { id },
        data: {
          ...data,
          profileLanguages: {
            connectOrCreate: profileLanguages.toConnect?.map((languageId) => ({
              where: {
                profileId_languageId: {
                  profileId: id,
                  languageId,
                },
              },
              create: {
                languageId: languageId,
              },
            })),
            deleteMany: profileLanguages.toDisconnect?.map((languageId) => ({
              profileId: id,
              languageId,
            })),
          },
          profileDrinks: {
            connectOrCreate: profileDrinks.toConnect?.map((drinkId) => ({
              where: {
                profileId_drinkId: {
                  profileId: id,
                  drinkId,
                },
              },
              create: {
                drinkId,
              },
            })),
            deleteMany: profileDrinks.toDisconnect?.map((drinkId) => ({
              profileId: id,
              drinkId,
            })),
          },
          profileFoodTypes: {
            connectOrCreate: profileFoodTypes.toConnect?.map((foodTypeId) => ({
              where: {
                profileId_foodTypeId: {
                  profileId: id,
                  foodTypeId,
                },
              },
              create: {
                foodTypeId,
              },
            })),
            deleteMany: profileFoodTypes.toDisconnect?.map((foodTypeId) => ({
              profileId: id,
              foodTypeId,
            })),
          },
        },
      });
    }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getProfile(ctx);
    return profile ?? null;
  }),
  getDrinkTypes: publicProcedure.query(async () => {
    return await getDrinkTypes();
  }),
  getLanguages: publicProcedure.query(async () => {
    return await getLanguages();
  }),
  getFoodTypes: publicProcedure.query(async () => {
    return await getFoodTypes();
  }),
});
