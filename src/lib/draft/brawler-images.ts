/**
 * Portrait assets are resolved from BrawlAPI/Brawlify's public static dataset.
 * The list is fetched once and cached for the lifetime of the page. The app
 * still works without the API: it falls back to initials and exposes the
 * canonical Brawlify page when a matching character is found.
 */
export interface BrawlerImageAsset {
  imageUrl: string;
  imagePageUrl: string;
  canonicalName: string;
}

type ApiBrawler = {
  name: string;
  imageUrl?: string;
  imageUrl2?: string;
  link?: string;
  released?: boolean;
};

let assetsPromise: Promise<Map<string, BrawlerImageAsset>> | null = null;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const aliases: Record<string, string[]> = {
  corvo: ["Crow"],
  eugenio: ["Gene"],
  misterp: ["Mr. P", "Mister P"],
  wattsonsurge: ["Surge"],
  coronelruffs: ["Ruffs", "Colonel Ruffs"],
  lightyearindisponivel: ["Buzz Lightyear", "Lightyear"],
  "8bit": ["8-Bit"],
  emz: ["Emz"],
};

// Brawlify CDN IDs for recently announced brawlers that may not have reached
// the BrawlAPI list yet. These use the same borderless portraits as the API.
const recentBrawlerImages: Record<string, BrawlerImageAsset> = {
  saposvoltaicos: {
    imageUrl: "https://cdn.brawlify.com/brawlers/borderless/16000111.png",
    imagePageUrl: "https://brawlify.com/brawlers/16000111",
    canonicalName: "Thunder Frogs",
  },
  rey: {
    imageUrl: "https://cdn.brawlify.com/brawlers/borderless/16000112.png",
    imagePageUrl: "https://brawlify.com/brawlers/16000112",
    canonicalName: "Rey",
  },
  ruby: {
    imageUrl: "https://cdn.brawlify.com/brawlers/borderless/16000113.png",
    imagePageUrl: "https://brawlify.com/brawlers/16000113",
    canonicalName: "Ruby",
  },
};

async function loadAssets(): Promise<Map<string, BrawlerImageAsset>> {
  const result = new Map<string, BrawlerImageAsset>();
  try {
    const response = await fetch("https://api.brawlapi.com/v1/brawlers");
    if (!response.ok) return result;
    const payload = (await response.json()) as { list?: ApiBrawler[] };
    for (const brawler of payload.list ?? []) {
      if (!brawler.name || !(brawler.imageUrl2 || brawler.imageUrl)) continue;
      const asset = {
        imageUrl: brawler.imageUrl2 || brawler.imageUrl!,
        imagePageUrl: brawler.link || "https://brawlify.com/brawlers",
        canonicalName: brawler.name,
      };
      result.set(normalize(brawler.name), asset);
    }
  } catch {
    // Network access is optional; portrait components gracefully use initials.
  }
  return result;
}

export function getBrawlerImageAsset(
  displayName: string,
  imageAlias?: string,
): Promise<BrawlerImageAsset | null> {
  if (!assetsPromise) assetsPromise = loadAssets();
  return assetsPromise.then((assets) => {
    const candidates = [imageAlias, ...(aliases[normalize(displayName)] ?? []), displayName].filter(
      Boolean,
    ) as string[];
    for (const candidate of candidates) {
      const asset = assets.get(normalize(candidate));
      if (asset) return asset;
    }
    return recentBrawlerImages[normalize(displayName)] ?? null;
  });
}
