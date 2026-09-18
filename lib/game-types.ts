export type CropType = "potato" | "carrot" | "corn";

export type SeedInventory = Record<CropType, number>;

export type MutationType = "normal" | "large" | "golden" | "prismatic";

export type PersonalityType =
  | "angry"
  | "protective"
  | "lazy"
  | "clever"
  | "mean";

export type CropDefinition = {
  name: string;
  emoji: string;
  cost: number;
  sellPrice: number;
  growTime: number;
};

export type MutationDefinition = {
  name: string;
  multiplier: number;
  chance: number;
  label: string;
};

export type Plot = {
  id: number;
  crop: CropType | null;
  plantedAt: number | null;
};

export type CollectionEntry = {
  crop: CropType;
  mutation: MutationType;
};

export type Fighter = {
  id: string;
  crop: CropType;
  mutation: MutationType;
  personality: PersonalityType;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
};

export type HarvestedCrop = {
  id: string;
  crop: CropType;
  mutation: MutationType;
  baseSellValue: number;
  sellValue: number;
  harvestedAt: number;
};
