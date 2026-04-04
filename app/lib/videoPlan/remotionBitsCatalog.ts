import fs from "fs";
import path from "path";

export type RemotionBitCatalogItem = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  family: string;
};

let cachedCatalog: RemotionBitCatalogItem[] | null = null;

async function loadInventoryRaw() {
  const inventoryPath = path.join(
    process.cwd(),
    "node_modules",
    "remotion-bits",
    "dist",
    "catalog",
    "inventory.generated.js",
  );

  if (!fs.existsSync(inventoryPath)) {
    return [] as Array<{
      id: string;
      name: string;
      description: string;
      tags?: string[];
      registryDependencies?: string[];
    }>;
  }

  const raw = fs.readFileSync(inventoryPath, "utf8");
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  const jsonText = raw.slice(start, end + 1);
  return JSON.parse(jsonText) as Array<{
    id: string;
    name: string;
    description: string;
    tags?: string[];
    registryDependencies?: string[];
  }>;
}

export async function getRemotionBitsCatalog(): Promise<RemotionBitCatalogItem[]> {
  if (cachedCatalog) return cachedCatalog;

  const inventory = await loadInventoryRaw();
  cachedCatalog = inventory.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    tags: item.tags || [],
    family: item.registryDependencies?.[0] || "custom",
  }));

  return cachedCatalog;
}
