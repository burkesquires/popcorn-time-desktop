/* eslint class-methods-use-this: off */
import {
  determineQuality,
  formatSeasonEpisodeToString,
  formatSeasonEpisodeToObject,
  convertTmdbToImdb,
  sortTorrentsBySeeders,
  getHealth,
  resolveCache,
  setCache,
} from "./BaseTorrentProvider";
import {
  Torrent,
  TorrentProviderInterface,
  TorrentKind,
  ProviderTorrent,
  ExtendedDetails,
  ShowDetail,
  TorrentSelection,
} from "./TorrentProviderInterface";

const providers: Promise<TorrentProviderInterface>[] = [
  import("./YtsTorrentProvider").then((e) => e.default || e),
  // import('./PbTorrentProvider').then(e => e.default || e),
  import("./PctTorrentProvider").then((e) => e.default || e),
  // import('./KatTorrentProvider').then(e => e.default || e)
];

export function filterShowTorrent(
  showTorrent: Torrent,
  season: number,
  episode: number
): boolean {
  return !!(
    showTorrent.metadata
      .toLowerCase()
      .includes(formatSeasonEpisodeToString(season, episode)) &&
    showTorrent.seeders !== 0 &&
    showTorrent.magnet
  );
}

/**
 * Select one 720p and 1080p quality movie from torrent list
 * By default, sort all torrents by seeders
 */
export function selectTorrents(
  torrents: Torrent[],
  returnAll: boolean,
  key: string
): TorrentSelection {
  const sortedTorrents = sortTorrentsBySeeders(
    torrents.filter(
      (torrent) =>
        torrent.quality !== "n/a" && torrent.quality !== "" && !!torrent.magnet
    )
  );

  const formattedTorrents = {
    "1080p": sortedTorrents.find((torrent) => torrent.quality === "1080p"),
    "720p": sortedTorrents.find((torrent) => torrent.quality === "720p"),
    "480p": sortedTorrents.find((torrent) => torrent.quality === "480p"),
  };

  // const formattedTorrents = returnAll
  //   ? sortedTorrents
  //   : {
  //       "1080p": sortedTorrents.find((torrent) => torrent.quality === "1080p"),
  //       "720p": sortedTorrents.find((torrent) => torrent.quality === "720p"),
  //       "480p": sortedTorrents.find((torrent) => torrent.quality === "480p"),
  //     };
  setCache(key, formattedTorrents);

  return formattedTorrents;
}

/**
 * Merge results from providers
 */
function appendAttributes(providerResults: ProviderTorrent[]): Torrent[] {
  return providerResults.flat().map((result) => ({
    ...result,
    health: getHealth(result.seeders || 0, result.leechers || 0),
    quality:
      "quality" in result
        ? result.quality
        : determineQuality(result.magnet, result.metadata),
  }));
}

export function filterShowsComplete(show: Torrent, season: number): boolean {
  const metadata = show.metadata.toLowerCase();

  return !!(
    metadata.includes(`${season} complete`) ||
    metadata.includes(`${season} [complete]`) ||
    metadata.includes(`${season} - complete`) ||
    metadata.includes(`season ${season}`) ||
    (metadata.includes(`s${formatSeasonEpisodeToObject(season).season}`) &&
      !metadata.includes("e0") &&
      show.seeders !== 0 &&
      show.magnet)
  );
}

export async function getStatuses() {
  const resolvedProviders = await Promise.all(providers);
  const statuses = await Promise.all(
    resolvedProviders.map((provider) => provider.getStatus())
  );
  return statuses.map((status, index) => ({
    providerName: resolvedProviders[index].providerName,
    online: status,
  }));
}

export default class TorrentAdapter {
  async getTorrent(
    itemId: string,
    type: TorrentKind,
    extendedDetails: ExtendedDetails = {},
    returnAll = false,
    method = "all",
    cache = true
  ): Promise<TorrentSelection> {
    const args = JSON.stringify({ extendedDetails, returnAll, method });

    if (resolveCache(args) && cache) {
      return resolveCache(args);
    }

    // Temporary hack to convert tmdbIds to imdbIds if necessary
    const imdbId = !itemId.includes("tt")
      ? await convertTmdbToImdb(itemId)
      : itemId;

    const torrentPromises = (await Promise.all(providers)).map((provider) =>
      provider.provide(imdbId, type)
    );

    switch (method) {
      case "all": {
        const providerResults = await Promise.all(torrentPromises);
        const { season, episode } = extendedDetails as ShowDetail;

        switch (type) {
          case "movies":
            return selectTorrents(
              appendAttributes(providerResults).map((result) => ({
                ...result,
                method: "movies",
              })),
              returnAll,
              args
            );
          case "shows":
            return selectTorrents(
              appendAttributes(providerResults)
                .filter((show: Torrent) => !!show.metadata)
                .filter((show: Torrent) =>
                  filterShowTorrent(show, season, episode)
                )
                .map((result) => ({
                  ...result,
                  method: "shows",
                })),
              returnAll,
              args
            );
          case "season_complete":
            return selectTorrents(
              appendAttributes(providerResults)
                .filter((show) => !!show.metadata)
                .filter((show) => filterShowsComplete(show, season))
                .map((result) => ({
                  ...result,
                  method: "season_complete",
                })),
              returnAll,
              args
            );
          default:
            throw new Error("Invalid query method");
        }
      }
      case "race": {
        return Promise.race(torrentPromises);
      }
      default:
        throw new Error("Invalid query method");
    }
  }
}
