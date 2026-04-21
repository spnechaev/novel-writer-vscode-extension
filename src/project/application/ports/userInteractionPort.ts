import type { EntityType } from "../../domain/types/projectTypes";

export interface EntityTypeOption {
  label: string;
  value: EntityType;
}

export interface UserInteractionPort {
  pickEntityType(options: EntityTypeOption[]): Promise<EntityType | undefined>;
  inputEntityTitle(): Promise<string | undefined>;
  openCreatedEntity(filePath: string): Promise<void>;
}
