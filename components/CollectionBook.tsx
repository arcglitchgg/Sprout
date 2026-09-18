import { crops, mutations } from "@/lib/game-data";
import type { CollectionEntry, CropType, MutationType } from "@/lib/game-types";

export default function CollectionBook({ collection }: { collection: CollectionEntry[] }) {
  const totalPossibleDiscoveries = Object.keys(crops).length * Object.keys(mutations).length;
  return (
    <section className="mt-6 rounded-2xl bg-[#f4e8c1] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          Collection Book 📖
        </h2>

        <span className="text-sm font-bold">
          {collection.length}/
          {totalPossibleDiscoveries}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(crops) as CropType[]).map(
          (cropKey) => (
            <div
              key={cropKey}
              className="rounded-xl bg-[#fff8dc] p-3"
            >
              <div className="mb-2 font-bold">
                {crops[cropKey].emoji}{" "}
                {crops[cropKey].name}
              </div>

              <div className="space-y-1 text-xs">
                {(
                  Object.keys(
                    mutations
                  ) as MutationType[]
                ).map((mutationKey) => {
                  const discovered =
                    collection.some(
                      (entry) =>
                        entry.crop === cropKey &&
                        entry.mutation ===
                        mutationKey
                    );

                  return (
                    <div
                      key={mutationKey}
                      className={
                        discovered
                          ? "font-bold"
                          : "opacity-30"
                      }
                    >
                      {discovered
                        ? mutations[mutationKey]
                          .label
                        : "❓"}{" "}
                      {
                        mutations[mutationKey]
                          .name
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </section>


  );
}
