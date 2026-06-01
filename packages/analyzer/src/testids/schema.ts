export type InventoryElementStatus = 'active' | 'deprecated' | 'removed';
export type InventoryElementStability = 'stable' | 'unstable' | 'dynamic';

export interface InventoryElement {
  testId: string;
  component?: string;
  elementType?: string;
  intent?: string;
  label?: string;
  sourceFile?: string;
  status: InventoryElementStatus;
  stability: InventoryElementStability;
  firstSeenAt?: string;
  lastSeenAt?: string;
  /** For dynamic IDs: pattern template, e.g. "users.table.row.{userId}.{action}-button" */
  pattern?: string;
  /** Owning team — overrides route-level owner when set */
  owner?: string;
}

export interface InventoryRoute {
  path: string;
  screen?: string;
  owner?: string;
  elements: InventoryElement[];
}

export interface TestIdInventory {
  version: string;
  app: string;
  generatedAt: string;
  routes: InventoryRoute[];
}
