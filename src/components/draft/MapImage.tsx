import { useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Imagens dos mapas obtidas dos links de imagem exibidos em BrawlZone Ranked
 * (https://brawlzone.net/ranked#mode-brawl-ball). Os arquivos são servidos
 * pelo CDN do Brawlify, que hospeda as imagens usadas pelo site.
 */
const MAP_IMAGES: Record<string, string> = {
  "Double Swoosh": "https://cdn.brawlify.com/maps/regular/15000115.png",
  "Gem Fort": "https://cdn.brawlify.com/maps/regular/15000010.png",
  "Hard Rock Mine": "https://cdn.brawlify.com/maps/regular/15000007.png",
  Undermine: "https://cdn.brawlify.com/maps/regular/15000011.png",
  "Crystal Arcade": "https://cdn.brawlify.com/maps/regular/15000008.png",
  "Bridge Too Far": "https://cdn.brawlify.com/maps/regular/15000072.png",
  "Hot Potato": "https://cdn.brawlify.com/maps/regular/15000053.png",
  "Kaboom Canyon": "https://cdn.brawlify.com/maps/regular/15000018.png",
  "Safe Zone": "https://cdn.brawlify.com/maps/regular/15000019.png",
  "Dry Season": "https://cdn.brawlify.com/maps/regular/15000083.png",
  Hideout: "https://cdn.brawlify.com/maps/regular/15000022.png",
  "Layer Cake": "https://cdn.brawlify.com/maps/regular/15000082.png",
  "Shooting Star": "https://cdn.brawlify.com/maps/regular/15000005.png",
  "Center Stage": "https://cdn.brawlify.com/maps/regular/15000132.png",
  "Pinball Dreams":
    "https://static.wikia.nocookie.net/brawlstars/images/e/e9/Pinball_Dreams-Map.png/revision/latest?cb=20251112135209",
  "Sneaky Fields": "https://cdn.brawlify.com/maps/regular/15000050.png",
  "Triple Dribble": "https://cdn.brawlify.com/maps/regular/15000025.png",
  "Beach Ball": "https://cdn.brawlify.com/maps/regular/15000143.png",
  "Dueling Beetles": "https://cdn.brawlify.com/maps/regular/15000306.png",
  "Open Business": "https://cdn.brawlify.com/maps/regular/15000292.png",
  "Parallel Plays": "https://cdn.brawlify.com/maps/regular/15000293.png",
  "Ring of Fire": "https://cdn.brawlify.com/maps/regular/15000300.png",
  "Belle's Rock": "https://cdn.brawlify.com/maps/regular/15000368.png",
  "Flaring Phoenix": "https://cdn.brawlify.com/maps/regular/15000440.png",
  "Flowing Springs": "https://cdn.brawlify.com/maps/regular/15000502.png",
  "Goldarm Gulch": "https://cdn.brawlify.com/maps/regular/15000367.png",
  "New Horizons": "https://cdn.brawlify.com/maps/regular/15000703.png",
  "Out in the Open": "https://cdn.brawlify.com/maps/regular/15000548.png",
};

export function MapImage({ name, className = "" }: { name: string; className?: string }) {
  const src = MAP_IMAGES[name];
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <>
      <div
        role={src ? "button" : undefined}
        tabIndex={src ? 0 : undefined}
        aria-label={src ? `Ampliar imagem do mapa ${name}` : undefined}
        title={src ? "Clique para ampliar" : undefined}
        onClick={(event) => {
          if (!src) return;
          event.stopPropagation();
          setIsPreviewOpen(true);
        }}
        onKeyDown={(event) => {
          if (!src || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          event.stopPropagation();
          setIsPreviewOpen(true);
        }}
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface ${src ? "cursor-zoom-in" : ""} ${className}`}
      >
        {src ? (
          <img
            src={src}
            alt={`Imagem do mapa ${name}`}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
              event.currentTarget.parentElement?.classList.add("map-image-fallback");
            }}
          />
        ) : (
          <MapIcon aria-hidden="true" className="size-6 text-muted-foreground" />
        )}
      </div>
      {src && (
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent
            overlayClassName="bg-black/55 backdrop-blur-md"
            className="h-fit w-fit max-w-[92vw] border-0 bg-transparent p-0 shadow-none [&>button]:right-2 [&>button]:top-2 [&>button]:rounded-full [&>button]:bg-background/80 [&>button]:p-2 [&>button]:opacity-100"
          >
            <DialogTitle className="sr-only">{name}</DialogTitle>
            <DialogDescription className="sr-only">
              Imagem ampliada do mapa {name}. Pressione Escape para fechar.
            </DialogDescription>
            <img
              src={src}
              alt={`Imagem ampliada do mapa ${name}`}
              className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
